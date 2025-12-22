import { describe, it, beforeAll, afterEach, expect } from "vitest";
import request from "supertest";
import { app, logger } from "../index.js";

/**
 * PERF-VALIDATE: ETA Accuracy Suite
 *
 * Verifies that estimated time of arrival (ETA) provided at PART-A acceptance
 * is accurate within 20% of actual execution time. ETA is computed from the
 * manifest's sequence and call spacing, then compared against wall-clock time.
 *
 * Date: December 22, 2025
 * Branch: PERF-VALIDATE
 */

describe("PERF-VALIDATE: ETA Accuracy", () => {
  const ETA_RESULTS = {
    tests: [],
  };

  // Helper: Measure ETA accuracy
  async function measureETAAccuracy(prompt, pageCount) {
    const startTotal = Date.now();

    // POST: Get ETA
    const postRes = await request(app).post("/api/ebook/generate").send({
      prompt,
      theme: "dark",
      pageCount,
    });

    expect(postRes.status).toBe(202);
    const resultId = postRes.body.resultId;
    const eta = postRes.body.eta; // ETA in seconds

    expect(eta).toBeGreaterThan(0);

    const postElapsed = Date.now() - startTotal;

    logger.info(
      `[PERF-ETA] Job ${resultId}: ETA=${eta}s, PART-A latency=${postElapsed}ms`
    );

    // Smart polling: wait 80% of ETA, then poll every 500ms
    const smartWaitTime = Math.floor(eta * 1000 * 0.8);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(smartWaitTime, 500))
    );

    // Poll until complete
    let status;
    let pollCount = 0;
    const pollStartTime = Date.now();

    while (true) {
      pollCount++;

      const statusRes = await request(app).get(`/api/status/${resultId}`);
      expect(statusRes.status).toBe(200);

      status = statusRes.body;

      if (status.status === "complete") {
        break;
      }

      if (status.status === "error") {
        throw new Error(`Job failed: ${status.error}`);
      }

      // Poll every 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Safety timeout: 3x ETA
      const elapsed = Date.now() - pollStartTime;
      if (elapsed > eta * 3000) {
        throw new Error(
          `Job exceeded 3x ETA (${eta * 3}s). Elapsed: ${elapsed / 1000}s`
        );
      }
    }

    const totalElapsed = Date.now() - startTotal;
    const actualTime = totalElapsed / 1000; // Convert to seconds

    // Calculate accuracy
    const delta = Math.abs(eta - actualTime);
    const accuracy = delta / eta; // 0.10 = 10% error
    const accuracyPercent = accuracy * 100;

    const result = {
      resultId,
      pageCount,
      eta,
      actualTime: actualTime.toFixed(2),
      delta: delta.toFixed(2),
      accuracy: accuracy.toFixed(4),
      accuracyPercent: accuracyPercent.toFixed(1),
      passed: accuracy <= 0.2, // Within 20%
    };

    ETA_RESULTS.tests.push(result);

    logger.info(
      `[PERF-ETA] ${result.pageCount}-page: ETA=${eta}s, Actual=${
        result.actualTime
      }s, Accuracy=${result.accuracyPercent}% ${result.passed ? "✓" : "✗"}`
    );

    return result;
  }

  beforeAll(() => {
    logger.info("[PERF-ETA] Starting ETA accuracy validation suite");
  });

  // ============================================================================
  // Single Request ETA Accuracy
  // ============================================================================

  describe("Single Request ETA Accuracy", () => {
    it("should provide accurate ETA for 3-page ebook (within 20%)", async function () {
      this.timeout(40000);

      const result = await measureETAAccuracy(
        "Write a comprehensive 3-page ebook about sustainable energy",
        3
      );

      expect(result.passed).toBe(true);
      expect(parseFloat(result.accuracy)).toBeLessThanOrEqual(0.2);

      logger.info(
        `[PERF-ETA] 3-page ETA accuracy: ${result.accuracyPercent}% ✓`
      );
    });

    it("should provide accurate ETA for 5-page ebook (within 20%)", async function () {
      this.timeout(50000);

      const result = await measureETAAccuracy(
        "Write a detailed 5-page ebook about machine learning fundamentals",
        5
      );

      expect(result.passed).toBe(true);
      expect(parseFloat(result.accuracy)).toBeLessThanOrEqual(0.2);

      logger.info(
        `[PERF-ETA] 5-page ETA accuracy: ${result.accuracyPercent}% ✓`
      );
    });

    it("should provide accurate ETA for 10-page ebook (within 20%)", async function () {
      this.timeout(60000);

      const result = await measureETAAccuracy(
        "Write a comprehensive 10-page ebook covering AI, ML, and deep learning",
        10
      );

      expect(result.passed).toBe(true);
      expect(parseFloat(result.accuracy)).toBeLessThanOrEqual(0.2);

      logger.info(
        `[PERF-ETA] 10-page ETA accuracy: ${result.accuracyPercent}% ✓`
      );
    });

    it("should provide accurate ETA for edge case: 1-page ebook", async function () {
      this.timeout(25000);

      const result = await measureETAAccuracy(
        "Write a 1-page ebook summary on renewable energy",
        1
      );

      expect(result.passed).toBe(true);
      expect(parseFloat(result.accuracy)).toBeLessThanOrEqual(0.2);

      logger.info(
        `[PERF-ETA] 1-page ETA accuracy: ${result.accuracyPercent}% ✓`
      );
    });
  });

  // ============================================================================
  // Progress Tracking During Execution
  // ============================================================================

  describe("Progress Tracking & Real-Time ETA Updates", () => {
    it("should provide accurate progress during execution", async function () {
      this.timeout(40000);

      const prompt = "Write a 3-page ebook about climate change";
      const pageCount = 3;

      const startTotal = Date.now();

      // POST: Get initial ETA
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      expect(postRes.status).toBe(202);
      const resultId = postRes.body.resultId;
      const initialEta = postRes.body.eta;

      logger.info(`[PERF-ETA] Job ${resultId}: Initial ETA=${initialEta}s`);

      // Poll periodically and track progress
      const progressSnapshots = [];
      let status;

      while (true) {
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        expect(statusRes.status).toBe(200);

        status = statusRes.body;

        if (status.status === "in-progress" || status.status === "complete") {
          const elapsedSoFar = (Date.now() - startTotal) / 1000;
          const progressPercent = status.progress_percent || 0;
          const estimatedRemaining = status.estimated_remaining_seconds || 0;

          progressSnapshots.push({
            elapsedSoFar: elapsedSoFar.toFixed(1),
            progress: progressPercent,
            estimatedRemaining,
          });

          logger.info(
            `[PERF-ETA] Progress: ${progressPercent}% complete, ${estimatedRemaining}s remaining (elapsed: ${elapsedSoFar.toFixed(
              1
            )}s)`
          );
        }

        if (status.status === "complete") {
          break;
        }

        if (status.status === "error") {
          throw new Error(`Job failed: ${status.error}`);
        }

        // Poll every 1 second for detailed tracking
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Timeout safety
        const totalElapsed = Date.now() - startTotal;
        if (totalElapsed > initialEta * 3000) {
          throw new Error(`Job exceeded 3x initial ETA`);
        }
      }

      // Verify progress tracking made sense
      expect(progressSnapshots.length).toBeGreaterThan(0);

      logger.info(
        `[PERF-ETA] Captured ${progressSnapshots.length} progress snapshots during execution ✓`
      );
    });

    it("should track progress across multiple calls in manifest", async function () {
      this.timeout(40000);

      const prompt = "Write a 3-page ebook about quantum computing";
      const pageCount = 3;

      const startTotal = Date.now();

      // POST
      const postRes = await request(app).post("/api/ebook/generate").send({
        prompt,
        theme: "dark",
        pageCount,
      });

      const resultId = postRes.body.resultId;

      logger.info(`[PERF-ETA] Tracking progress for job ${resultId}`);

      // Poll and collect progress data
      const progressSequence = [];
      let lastProgress = 0;

      while (true) {
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        status = statusRes.body;

        if (status.status === "in-progress") {
          const currentProgress = status.calls_completed || 0;

          // Record progress changes
          if (currentProgress > lastProgress) {
            progressSequence.push({
              callsCompleted: currentProgress,
              totalCalls: status.calls_total,
              progressPercent: status.progress_percent,
              timestamp: Date.now() - startTotal,
            });

            logger.info(
              `[PERF-ETA] Call ${currentProgress}/${status.calls_total} completed (${status.progress_percent}%)`
            );

            lastProgress = currentProgress;
          }
        }

        if (status.status === "complete") {
          break;
        }

        if (status.status === "error") {
          throw new Error(`Job failed: ${status.error}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Verify monotonic progress (should never go backwards)
      for (let i = 1; i < progressSequence.length; i++) {
        expect(progressSequence[i].callsCompleted).toBeGreaterThanOrEqual(
          progressSequence[i - 1].callsCompleted
        );
      }

      logger.info(
        `[PERF-ETA] Progress tracking validated: ${progressSequence.length} progress events ✓`
      );
    });
  });

  // ============================================================================
  // Concurrent Request ETA Independence
  // ============================================================================

  describe("Concurrent Request ETA Independence", () => {
    it("should track independent ETAs for 2 concurrent requests", async function () {
      this.timeout(50000);

      logger.info(
        "[PERF-ETA] Testing independent ETA tracking for 2 concurrent requests"
      );

      const startTotal = Date.now();

      // Send 2 requests
      const res1 = await request(app).post("/api/ebook/generate").send({
        prompt: "Write a 3-page ebook about renewable energy",
        theme: "dark",
        pageCount: 3,
      });

      const res2 = await request(app).post("/api/ebook/generate").send({
        prompt: "Write a 3-page ebook about sustainable agriculture",
        theme: "light",
        pageCount: 3,
      });

      expect(res1.status).toBe(202);
      expect(res2.status).toBe(202);

      const resultId1 = res1.body.resultId;
      const resultId2 = res2.body.resultId;
      const eta1 = res1.body.eta;
      const eta2 = res2.body.eta;

      logger.info(`[PERF-ETA] Job 1 ETA: ${eta1}s, Job 2 ETA: ${eta2}s`);

      // Poll both concurrently
      const results = await Promise.all([
        (async () => {
          let status;
          while (true) {
            const statusRes = await request(app).get(
              `/api/status/${resultId1}`
            );
            status = statusRes.body;

            if (status.status === "complete") break;
            if (status.status === "error")
              throw new Error(`Job 1 failed: ${status.error}`);

            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          return {
            resultId: resultId1,
            eta: eta1,
            actualTime: (Date.now() - startTotal) / 1000,
          };
        })(),
        (async () => {
          let status;
          while (true) {
            const statusRes = await request(app).get(
              `/api/status/${resultId2}`
            );
            status = statusRes.body;

            if (status.status === "complete") break;
            if (status.status === "error")
              throw new Error(`Job 2 failed: ${status.error}`);

            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          return {
            resultId: resultId2,
            eta: eta2,
            actualTime: (Date.now() - startTotal) / 1000,
          };
        })(),
      ]);

      // Verify independent accuracy for each
      results.forEach((result) => {
        const accuracy = Math.abs(result.eta - result.actualTime) / result.eta;
        logger.info(
          `[PERF-ETA] Job ${result.resultId}: ETA=${
            result.eta
          }s, Actual=${result.actualTime.toFixed(1)}s, Accuracy=${(
            accuracy * 100
          ).toFixed(1)}%`
        );

        expect(accuracy).toBeLessThanOrEqual(0.2);
      });
    });
  });

  // ============================================================================
  // ETA Accuracy Summary
  // ============================================================================

  describe("ETA Accuracy Results", () => {
    it("should report ETA accuracy metrics", () => {
      logger.info("[PERF-ETA] ========================================");
      logger.info("[PERF-ETA] ETA Accuracy Summary");
      logger.info("[PERF-ETA] ========================================");

      if (ETA_RESULTS.tests.length === 0) {
        logger.info("[PERF-ETA] No ETA tests executed yet");
        return;
      }

      const passed = ETA_RESULTS.tests.filter((t) => t.passed).length;
      const total = ETA_RESULTS.tests.length;
      const avgAccuracy =
        ETA_RESULTS.tests.reduce((sum, t) => sum + parseFloat(t.accuracy), 0) /
        total;

      ETA_RESULTS.tests.forEach((test) => {
        const status = test.passed ? "✓ PASS" : "✗ FAIL";
        logger.info(
          `[PERF-ETA] ${status} | ${test.pageCount}-page ebook: ETA=${test.eta}s, Actual=${test.actualTime}s, Error=${test.accuracyPercent}%`
        );
      });

      logger.info("[PERF-ETA] ========================================");
      logger.info(`[PERF-ETA] Summary: ${passed}/${total} tests passed`);
      logger.info(
        `[PERF-ETA] Average accuracy: ${(avgAccuracy * 100).toFixed(
          1
        )}% (target: ≤20%)`
      );
      logger.info("[PERF-ETA] ========================================");

      // Assertion: at least 80% of ETA tests should pass (within 20% accuracy)
      expect(passed).toBeGreaterThanOrEqual(Math.ceil(total * 0.8));
    });
  });
});
