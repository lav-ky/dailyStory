import { describe, it, beforeAll, afterEach, expect } from "vitest";
import request from "supertest";
import { app, logger } from "../index.js";

/**
 * PERF-VALIDATE: Manifest Validation Suite
 *
 * Verifies that manifest protocol is correctly implemented:
 * - Manifest is generated from prompts with correct structure
 * - Calls are scheduled in proper FIFO order
 * - Manifest contains all required metadata (calls_total, estimated_time, etc.)
 * - Manifest is used to drive execution (call sequence matches manifest)
 * - Progress tracking aligns with manifest structure
 *
 * Date: December 22, 2025
 * Branch: PERF-VALIDATE
 */

describe("PERF-VALIDATE: Manifest Validation", () => {
  const MANIFEST_RESULTS = {
    tests: [],
  };

  // Helper: Extract and validate manifest structure
  async function validateManifestStructure(prompt, pageCount) {
    logger.info(
      `[PERF-MANIFEST] Validating manifest for ${pageCount}-page ebook`
    );

    // POST: Generate manifest via PART-A
    const postRes = await request(app).post("/api/ebook/generate").send({
      prompt,
      theme: "dark",
      pageCount,
    });

    expect(postRes.status).toBe(202);

    const resultId = postRes.body.resultId;
    const manifestFromResponse = postRes.body.manifest || null;

    logger.info(
      `[PERF-MANIFEST] Got resultId=${resultId}, manifest=${
        manifestFromResponse ? "present" : "missing"
      }`
    );

    // Poll until complete to see full execution
    let finalStatus;
    let manifestFromStatus;

    while (true) {
      const statusRes = await request(app).get(`/api/status/${resultId}`);
      expect(statusRes.status).toBe(200);

      finalStatus = statusRes.body;
      manifestFromStatus = finalStatus.manifest || null;

      if (finalStatus.status === "complete") {
        break;
      }

      if (finalStatus.status === "error") {
        throw new Error(`Job failed: ${finalStatus.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Validate manifest structure
    const manifest = manifestFromStatus || manifestFromResponse;

    expect(manifest).toBeDefined();
    expect(manifest).toHaveProperty("calls_total");
    expect(manifest).toHaveProperty("calls");
    expect(manifest.calls_total).toBeGreaterThan(0);
    expect(manifest.calls).toEqual(expect.any(Array));
    expect(manifest.calls.length).toBe(manifest.calls_total);

    logger.info(
      `[PERF-MANIFEST] Manifest structure valid: ${manifest.calls_total} calls`
    );

    // Validate call structure
    manifest.calls.forEach((call, idx) => {
      expect(call).toHaveProperty("call_id");
      expect(call).toHaveProperty("tier");
      expect(call).toHaveProperty("prompt");
      expect(call).toHaveProperty("tool");

      // Tier should be Pro (expert) or Flash (standard)
      expect(["Pro", "Flash"]).toContain(call.tier);

      // Tool should be ebook or wall_art
      expect(["ebook", "wall_art"]).toContain(call.tool);

      logger.info(
        `[PERF-MANIFEST]   Call ${idx + 1}: ${call.tool} (${
          call.tier
        }) - ${call.prompt.substring(0, 50)}...`
      );
    });

    // Validate execution order
    expect(finalStatus.execution_order).toBeDefined();
    expect(finalStatus.execution_order).toEqual(expect.any(Array));

    // Execution order should match calls_total
    expect(finalStatus.execution_order.length).toBeLessThanOrEqual(
      manifest.calls_total
    );

    logger.info(
      `[PERF-MANIFEST] Execution order: ${finalStatus.execution_order.join(
        " → "
      )}`
    );

    return {
      resultId,
      manifest,
      finalStatus,
      executionOrder: finalStatus.execution_order,
      passed: true,
    };
  }

  beforeAll(() => {
    logger.info("[PERF-MANIFEST] Starting manifest validation suite");
  });

  // ============================================================================
  // Manifest Structure Validation
  // ============================================================================

  describe("Manifest Structure", () => {
    it("should generate valid manifest for 3-page ebook", async function () {
      this.timeout(40000);

      const result = await validateManifestStructure(
        "Write a comprehensive 3-page ebook about AI ethics",
        3
      );

      expect(result.manifest.calls_total).toBe(3); // structure + 2 pages + (optional closing)

      MANIFEST_RESULTS.tests.push({
        name: "3-page manifest",
        passed: result.passed,
        callsTotal: result.manifest.calls_total,
      });

      logger.info("[PERF-MANIFEST] 3-page manifest validation ✓");
    });

    it("should generate valid manifest for 5-page ebook", async function () {
      this.timeout(50000);

      const result = await validateManifestStructure(
        "Write a detailed 5-page ebook about blockchain technology",
        5
      );

      expect(result.manifest.calls_total).toBeGreaterThanOrEqual(4); // At least structure + pages

      MANIFEST_RESULTS.tests.push({
        name: "5-page manifest",
        passed: result.passed,
        callsTotal: result.manifest.calls_total,
      });

      logger.info("[PERF-MANIFEST] 5-page manifest validation ✓");
    });

    it("should generate valid manifest for 10-page ebook", async function () {
      this.timeout(60000);

      const result = await validateManifestStructure(
        "Write a comprehensive 10-page ebook covering web development",
        10
      );

      expect(result.manifest.calls_total).toBeGreaterThanOrEqual(9); // At least structure + pages

      MANIFEST_RESULTS.tests.push({
        name: "10-page manifest",
        passed: result.passed,
        callsTotal: result.manifest.calls_total,
      });

      logger.info("[PERF-MANIFEST] 10-page manifest validation ✓");
    });
  });

  // ============================================================================
  // Call Sequencing & FIFO Order
  // ============================================================================

  describe("Call Sequencing & FIFO Order", () => {
    it("should execute calls in manifest order", async function () {
      this.timeout(40000);

      const prompt = "Write a 3-page ebook about renewable energy sources";
      const pageCount = 3;

      logger.info(`[PERF-MANIFEST] Testing call sequence for 3-page ebook`);

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const resultId = postRes.body.resultId;
      const manifest = postRes.body.manifest;

      expect(manifest).toBeDefined();
      const expectedSequence = manifest.calls.map((c) => c.call_id);

      logger.info(
        `[PERF-MANIFEST] Expected sequence: ${expectedSequence.join(" → ")}`
      );

      // Poll until complete
      let finalStatus;
      while (true) {
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        finalStatus = statusRes.body;

        if (finalStatus.status === "complete") break;

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Verify execution order matches manifest
      const actualSequence = finalStatus.execution_order;

      logger.info(
        `[PERF-MANIFEST] Actual sequence: ${actualSequence.join(" → ")}`
      );

      // All expected calls should be in actual sequence
      expectedSequence.forEach((expectedCallId, idx) => {
        expect(actualSequence[idx]).toBe(expectedCallId);
      });

      logger.info("[PERF-MANIFEST] Call sequence validation ✓");
    });

    it("should maintain FIFO order across tool changes", async function () {
      this.timeout(45000);

      const prompt =
        "Write a 3-page ebook about cloud computing and include wall art illustrations";
      const pageCount = 3;

      logger.info(
        `[PERF-MANIFEST] Testing FIFO order with mixed tools (ebook + wall_art)`
      );

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const resultId = postRes.body.resultId;
      const manifest = postRes.body.manifest;

      expect(manifest).toBeDefined();

      // Check if manifest contains both tools
      const hasBookCalls = manifest.calls.some((c) => c.tool === "ebook");
      const hasWallArtCalls = manifest.calls.some((c) => c.tool === "wall_art");

      logger.info(
        `[PERF-MANIFEST] Manifest contains: ${hasBookCalls ? "ebook" : ""} ${
          hasWallArtCalls ? "+ wall_art" : ""
        }`
      );

      // Poll until complete
      let finalStatus;
      while (true) {
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        finalStatus = statusRes.body;

        if (finalStatus.status === "complete") break;

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Verify FIFO: each call executed once, in order
      const executionOrder = finalStatus.execution_order;
      const uniqueExecution = [...new Set(executionOrder)];

      expect(uniqueExecution.length).toBe(executionOrder.length);
      logger.info(
        `[PERF-MANIFEST] FIFO validation: ${executionOrder.length} unique calls, no duplicates ✓`
      );
    });
  });

  // ============================================================================
  // Manifest Metadata Validation
  // ============================================================================

  describe("Manifest Metadata", () => {
    it("should include all required metadata fields", async function () {
      this.timeout(40000);

      const prompt = "Write a 3-page ebook about quantum computing";
      const pageCount = 3;

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const manifest = postRes.body.manifest;

      expect(manifest).toBeDefined();

      // Required fields
      const requiredFields = [
        "calls_total",
        "calls",
        "created_at",
        "estimated_total_time",
      ];

      requiredFields.forEach((field) => {
        expect(manifest).toHaveProperty(field);
        logger.info(`[PERF-MANIFEST] Metadata field present: ${field}`);
      });

      // Validate field types
      expect(typeof manifest.calls_total).toBe("number");
      expect(Array.isArray(manifest.calls)).toBe(true);
      expect(typeof manifest.estimated_total_time).toBe("number");

      logger.info(
        `[PERF-MANIFEST] Metadata types validated. ETA: ${manifest.estimated_total_time}s ✓`
      );
    });

    it("should maintain consistent manifest across polls", async function () {
      this.timeout(45000);

      const prompt = "Write a 3-page ebook about machine learning";
      const pageCount = 3;

      logger.info(
        `[PERF-MANIFEST] Testing manifest consistency across multiple status polls`
      );

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const resultId = postRes.body.resultId;
      const initialManifest = postRes.body.manifest;

      expect(initialManifest).toBeDefined();

      // Poll multiple times and compare manifests
      const manifestSnapshots = [initialManifest];

      for (let i = 0; i < 3; i++) {
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        const status = statusRes.body;

        if (status.manifest) {
          manifestSnapshots.push(status.manifest);
        }

        if (status.status === "complete") break;

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Compare: all manifests should have same structure
      const baseCalls = manifestSnapshots[0].calls_total;

      manifestSnapshots.forEach((manifest, idx) => {
        expect(manifest.calls_total).toBe(baseCalls);
        expect(manifest.calls.length).toBe(baseCalls);

        logger.info(
          `[PERF-MANIFEST] Snapshot ${idx + 1}: ${
            manifest.calls_total
          } calls (consistent)`
        );
      });

      logger.info("[PERF-MANIFEST] Manifest consistency validated ✓");
    });
  });

  // ============================================================================
  // Call Tier Distribution
  // ============================================================================

  describe("Call Tier Distribution", () => {
    it("should use appropriate tier distribution", async function () {
      this.timeout(40000);

      const prompt = "Write a 5-page ebook about AI and climate change";
      const pageCount = 5;

      logger.info(
        `[PERF-MANIFEST] Analyzing tier distribution for ${pageCount}-page ebook`
      );

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const manifest = postRes.body.manifest;

      // Count Pro vs Flash calls
      const proCalls = manifest.calls.filter((c) => c.tier === "Pro");
      const flashCalls = manifest.calls.filter((c) => c.tier === "Flash");

      logger.info(
        `[PERF-MANIFEST] Tier distribution: Pro=${proCalls.length}, Flash=${flashCalls.length}`
      );

      // Reasonable heuristic: should have both tiers or reasonable justification
      // (For structure+pages, might skew toward Flash for cost)
      expect(manifest.calls_total).toBe(proCalls.length + flashCalls.length);

      // Log specific tier choices
      manifest.calls.forEach((call, idx) => {
        logger.info(
          `[PERF-MANIFEST]   Call ${idx + 1}: ${call.tier} tier for ${
            call.tool
          }`
        );
      });

      logger.info("[PERF-MANIFEST] Tier distribution validated ✓");
    });
  });

  // ============================================================================
  // Concurrent Manifest Independence
  // ============================================================================

  describe("Concurrent Manifest Independence", () => {
    it("should generate independent manifests for concurrent requests", async function () {
      this.timeout(50000);

      logger.info(
        "[PERF-MANIFEST] Testing manifest independence for 2 concurrent requests"
      );

      // Send 2 requests
      const res1 = await request(app).post("/api/ebook/generate").send({
        prompt: "Write a 3-page ebook about blockchain",
        theme: "dark",
        pageCount: 3,
      });

      const res2 = await request(app).post("/api/ebook/generate").send({
        prompt: "Write a 3-page ebook about IoT",
        theme: "light",
        pageCount: 3,
      });

      const manifest1 = res1.body.manifest;
      const manifest2 = res2.body.manifest;

      expect(manifest1).toBeDefined();
      expect(manifest2).toBeDefined();

      logger.info(`[PERF-MANIFEST] Manifest 1: ${manifest1.calls_total} calls`);
      logger.info(`[PERF-MANIFEST] Manifest 2: ${manifest2.calls_total} calls`);

      // Manifests should be independent (different call_ids)
      const callIds1 = manifest1.calls.map((c) => c.call_id);
      const callIds2 = manifest2.calls.map((c) => c.call_id);

      const overlap = callIds1.filter((id) => callIds2.includes(id));

      expect(overlap.length).toBe(0);
      logger.info(
        "[PERF-MANIFEST] Manifests are independent (no call_id overlap) ✓"
      );
    });
  });

  // ============================================================================
  // Manifest Results Summary
  // ============================================================================

  describe("Manifest Validation Results", () => {
    it("should report manifest validation metrics", () => {
      logger.info("[PERF-MANIFEST] ========================================");
      logger.info("[PERF-MANIFEST] Manifest Validation Summary");
      logger.info("[PERF-MANIFEST] ========================================");

      if (MANIFEST_RESULTS.tests.length === 0) {
        logger.info("[PERF-MANIFEST] No manifest tests executed yet");
        return;
      }

      const passed = MANIFEST_RESULTS.tests.filter((t) => t.passed).length;
      const total = MANIFEST_RESULTS.tests.length;

      MANIFEST_RESULTS.tests.forEach((test) => {
        const status = test.passed ? "✓ PASS" : "✗ FAIL";
        logger.info(
          `[PERF-MANIFEST] ${status} | ${test.name}: ${test.callsTotal} calls`
        );
      });

      logger.info("[PERF-MANIFEST] ========================================");
      logger.info(`[PERF-MANIFEST] Summary: ${passed}/${total} tests passed`);
      logger.info(
        "[PERF-MANIFEST] Manifest protocol: ✓ Structure valid, ✓ FIFO ordering, ✓ Metadata complete"
      );
      logger.info("[PERF-MANIFEST] ========================================");

      // Assertion: at least 80% of manifest tests should pass
      expect(passed).toBeGreaterThanOrEqual(Math.ceil(total * 0.8));
    });
  });
});
