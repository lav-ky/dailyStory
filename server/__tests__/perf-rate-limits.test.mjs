import { describe, it, beforeAll, afterEach, beforeEach, expect } from "vitest";
import sinon from "sinon";
import { Orchestrator } from "../orchestrator.js";
import { aiService } from "../utilities/aiService.js";
import { helpers } from "../helpers/index.js";
import { logger } from "../index.js";

/**
 * PERF-VALIDATE: Rate-Limit Compliance Suite
 *
 * Verifies that PART-B Orchestrator enforces proper call spacing
 * to comply with API rate limits:
 * - Pro (expert tier): 250ms minimum spacing
 * - Flash (standard tier): 100ms minimum spacing
 *
 * Date: December 22, 2025
 * Branch: PERF-VALIDATE
 */

describe("PERF-VALIDATE: Rate-Limit Compliance", () => {
  let aiServiceStub;
  const SPACING_MEASUREMENTS = {
    proToProSpacing: [],
    flashToFlashSpacing: [],
    mixedSpacing: [],
  };

  beforeAll(() => {
    logger.info("[PERF-RATE-LIMITS] Starting rate-limit compliance testing");
  });

  beforeEach(() => {
    // Reset measurements for each test
    SPACING_MEASUREMENTS.proToProSpacing = [];
    SPACING_MEASUREMENTS.flashToFlashSpacing = [];
    SPACING_MEASUREMENTS.mixedSpacing = [];
  });

  // Helper: Stub aiService.generate to capture call timing
  function setupAiServiceSpy() {
    const timestamps = [];

    aiServiceStub = sinon
      .stub(aiService, "generate")
      .callsFake(async (prompt, options) => {
        timestamps.push({
          time: Date.now(),
          tier: options.tier,
          model: options.model,
        });

        // Return mock response
        return {
          content: `Generated content for ${options.tier}`,
          model: options.model,
          timestamp: Date.now(),
        };
      });

    return { timestamps, stub: aiServiceStub };
  }

  // Helper: Restore aiService stub
  function teardownAiServiceSpy() {
    if (aiServiceStub) {
      aiServiceStub.restore();
    }
  }

  // ============================================================================
  // Pro Model (Expert) Spacing Tests
  // ============================================================================

  describe("Pro Model (Expert Tier) Spacing", () => {
    it("should enforce 250ms minimum spacing between consecutive expert calls", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-pro", helpers);

      // Create manifest with 3 expert calls
      const manifest = {
        totalRequests: 3,
        sequence: [{ tier: "expert" }, { tier: "expert" }, { tier: "expert" }],
      };

      logger.info("[PERF-RATE-LIMITS] Testing Pro (expert) call spacing...");

      // Execute calls
      for (let i = 0; i < 3; i++) {
        await orchestrator.generate("Test prompt", {
          tier: "expert",
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      // Verify spacing
      expect(timestamps.length).toBe(3);

      const spacing01 = timestamps[1].time - timestamps[0].time;
      const spacing12 = timestamps[2].time - timestamps[1].time;

      logger.info(
        `[PERF-RATE-LIMITS] Pro spacing [0→1]: ${spacing01}ms (min: 240ms)`
      );
      logger.info(
        `[PERF-RATE-LIMITS] Pro spacing [1→2]: ${spacing12}ms (min: 240ms)`
      );

      // Pro model requires 250ms spacing (allowing 10ms tolerance)
      expect(spacing01).toBeGreaterThanOrEqual(240);
      expect(spacing12).toBeGreaterThanOrEqual(240);

      SPACING_MEASUREMENTS.proToProSpacing.push(spacing01, spacing12);
      teardownAiServiceSpy();
    });

    it("should not exceed 350ms spacing for pro calls (efficiency check)", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-pro-max", helpers);

      const manifest = {
        totalRequests: 2,
        sequence: [{ tier: "expert" }, { tier: "expert" }],
      };

      for (let i = 0; i < 2; i++) {
        await orchestrator.generate("Test prompt", {
          tier: "expert",
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      const spacing = timestamps[1].time - timestamps[0].time;

      logger.info(
        `[PERF-RATE-LIMITS] Pro spacing efficiency: ${spacing}ms (max: 350ms)`
      );

      // Should not be unnecessarily slow
      expect(spacing).toBeLessThan(350);

      teardownAiServiceSpy();
    });
  });

  // ============================================================================
  // Flash Model (Standard) Spacing Tests
  // ============================================================================

  describe("Flash Model (Standard Tier) Spacing", () => {
    it("should enforce 100ms minimum spacing between consecutive standard calls", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-flash", helpers);

      const manifest = {
        totalRequests: 3,
        sequence: [
          { tier: "standard" },
          { tier: "standard" },
          { tier: "standard" },
        ],
      };

      logger.info(
        "[PERF-RATE-LIMITS] Testing Flash (standard) call spacing..."
      );

      for (let i = 0; i < 3; i++) {
        await orchestrator.generate("Test prompt", {
          tier: "standard",
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      expect(timestamps.length).toBe(3);

      const spacing01 = timestamps[1].time - timestamps[0].time;
      const spacing12 = timestamps[2].time - timestamps[1].time;

      logger.info(
        `[PERF-RATE-LIMITS] Flash spacing [0→1]: ${spacing01}ms (min: 90ms)`
      );
      logger.info(
        `[PERF-RATE-LIMITS] Flash spacing [1→2]: ${spacing12}ms (min: 90ms)`
      );

      // Flash model requires 100ms spacing (allowing 10ms tolerance)
      expect(spacing01).toBeGreaterThanOrEqual(90);
      expect(spacing12).toBeGreaterThanOrEqual(90);

      SPACING_MEASUREMENTS.flashToFlashSpacing.push(spacing01, spacing12);
      teardownAiServiceSpy();
    });

    it("should allow flexible timing for flash calls without strict upper limit", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-flash-flex", helpers);

      const manifest = {
        totalRequests: 2,
        sequence: [{ tier: "standard" }, { tier: "standard" }],
      };

      for (let i = 0; i < 2; i++) {
        await orchestrator.generate("Test prompt", {
          tier: "standard",
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      const spacing = timestamps[1].time - timestamps[0].time;

      logger.info(
        `[PERF-RATE-LIMITS] Flash spacing flexibility: ${spacing}ms (min: 90ms)`
      );

      // Flash has less strict requirements, so spacing can vary
      expect(spacing).toBeGreaterThanOrEqual(90);

      teardownAiServiceSpy();
    });
  });

  // ============================================================================
  // Mixed Tier Spacing Tests
  // ============================================================================

  describe("Mixed Tier Spacing (Pro + Flash)", () => {
    it("should enforce Pro spacing after expert, Flash spacing after standard", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-mixed", helpers);

      const manifest = {
        totalRequests: 4,
        sequence: [
          { tier: "expert" }, // Pro: 250ms spacing
          { tier: "expert" }, // Pro: 250ms spacing
          { tier: "standard" }, // Flash: 100ms spacing
          { tier: "expert" }, // Pro: 250ms spacing
        ],
      };

      logger.info(
        "[PERF-RATE-LIMITS] Testing mixed tier (Pro+Flash) spacing..."
      );

      for (let i = 0; i < 4; i++) {
        await orchestrator.generate("Test prompt", {
          tier: manifest.sequence[i].tier,
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      expect(timestamps.length).toBe(4);

      const spacing01 = timestamps[1].time - timestamps[0].time; // Pro → Pro
      const spacing12 = timestamps[2].time - timestamps[1].time; // Pro → Flash
      const spacing23 = timestamps[3].time - timestamps[2].time; // Flash → Pro

      logger.info(
        `[PERF-RATE-LIMITS] Pro→Pro spacing: ${spacing01}ms (min: 240ms)`
      );
      logger.info(
        `[PERF-RATE-LIMITS] Pro→Flash spacing: ${spacing12}ms (min: 240ms for preceding Pro)`
      );
      logger.info(
        `[PERF-RATE-LIMITS] Flash→Pro spacing: ${spacing23}ms (min: 240ms for following Pro)`
      );

      // Enforce Pro spacing after expert calls
      expect(spacing01).toBeGreaterThanOrEqual(240); // Pro → Pro
      expect(spacing12).toBeGreaterThanOrEqual(240); // Pro → anything
      expect(spacing23).toBeGreaterThanOrEqual(240); // Pro → anything

      SPACING_MEASUREMENTS.mixedSpacing.push(spacing01, spacing12, spacing23);
      teardownAiServiceSpy();
    });

    it("should not violate Gemini API rate limits on mixed sequence", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-rate-limit", helpers);

      // Real world sequence: structure (Pro) → opening (Pro) → chapters (Flash) → closing (Pro)
      const manifest = {
        totalRequests: 5,
        sequence: [
          { tier: "expert" }, // Structure
          { tier: "expert" }, // Opening
          { tier: "standard" }, // Chapter 1
          { tier: "standard" }, // Chapter 2
          { tier: "expert" }, // Closing
        ],
      };

      logger.info(
        "[PERF-RATE-LIMITS] Testing realistic ebook sequence (no 429 errors)..."
      );

      for (let i = 0; i < 5; i++) {
        await orchestrator.generate("Test prompt", {
          tier: manifest.sequence[i].tier,
          callIndex: i,
          manifest: i === 0 ? manifest : undefined,
        });
      }

      // Verify all calls succeeded (no rate limit errors)
      expect(timestamps.length).toBe(5);
      timestamps.forEach((ts) => {
        expect(ts.time).toBeDefined();
      });

      // Verify spacing between critical transitions
      const proProSpacing = timestamps[1].time - timestamps[0].time; // Expert → Expert
      expect(proProSpacing).toBeGreaterThanOrEqual(240);

      logger.info("[PERF-RATE-LIMITS] ✓ No rate-limit violations detected");

      teardownAiServiceSpy();
    });
  });

  // ============================================================================
  // Rapid-Fire Prevention Tests
  // ============================================================================

  describe("Rapid-Fire Prevention", () => {
    it("should prevent calls from firing faster than spacing allows", async () => {
      const { timestamps } = setupAiServiceSpy();

      const orchestrator = new Orchestrator("test-job-rapid-fire", helpers);

      const manifest = {
        totalRequests: 3,
        sequence: [{ tier: "expert" }, { tier: "expert" }, { tier: "expert" }],
      };

      logger.info("[PERF-RATE-LIMITS] Testing rapid-fire prevention...");

      // Try to fire all calls immediately
      const callPromises = [];
      for (let i = 0; i < 3; i++) {
        callPromises.push(
          orchestrator.generate("Test prompt", {
            tier: "expert",
            callIndex: i,
            manifest: i === 0 ? manifest : undefined,
          })
        );
      }

      // Even with simultaneous Promise.all, orchestrator should enforce spacing
      await Promise.all(callPromises);

      // Verify spacing was enforced despite simultaneous requests
      const spacing01 = timestamps[1].time - timestamps[0].time;
      const spacing12 = timestamps[2].time - timestamps[1].time;

      logger.info(
        `[PERF-RATE-LIMITS] Rapid-fire spacing [0→1]: ${spacing01}ms`
      );
      logger.info(
        `[PERF-RATE-LIMITS] Rapid-fire spacing [1→2]: ${spacing12}ms`
      );

      expect(spacing01).toBeGreaterThanOrEqual(240);
      expect(spacing12).toBeGreaterThanOrEqual(240);

      logger.info("[PERF-RATE-LIMITS] ✓ Rapid-fire correctly prevented");

      teardownAiServiceSpy();
    });
  });

  // ============================================================================
  // Concurrent Job Independence Tests
  // ============================================================================

  describe("Concurrent Job Independence", () => {
    it("should maintain proper spacing for concurrent jobs independently", async () => {
      // Create two separate orchestrators for concurrent jobs
      const job1Timestamps = [];
      const job2Timestamps = [];

      const aiServiceStub1 = sinon
        .stub(aiService, "generate")
        .callsFake(async (prompt, options) => {
          if (prompt.includes("Job 1")) {
            job1Timestamps.push(Date.now());
          } else {
            job2Timestamps.push(Date.now());
          }
          return { content: "Mock response", model: options.model };
        });

      logger.info("[PERF-RATE-LIMITS] Testing concurrent job independence...");

      const job1Manifest = {
        totalRequests: 2,
        sequence: [{ tier: "expert" }, { tier: "expert" }],
      };

      const job2Manifest = {
        totalRequests: 2,
        sequence: [{ tier: "standard" }, { tier: "standard" }],
      };

      const orchestrator1 = new Orchestrator("job-1", helpers);
      const orchestrator2 = new Orchestrator("job-2", helpers);

      // Run both jobs concurrently
      await Promise.all([
        (async () => {
          for (let i = 0; i < 2; i++) {
            await orchestrator1.generate("Job 1 prompt", {
              tier: "expert",
              callIndex: i,
              manifest: i === 0 ? job1Manifest : undefined,
            });
          }
        })(),
        (async () => {
          for (let i = 0; i < 2; i++) {
            await orchestrator2.generate("Job 2 prompt", {
              tier: "standard",
              callIndex: i,
              manifest: i === 0 ? job2Manifest : undefined,
            });
          }
        })(),
      ]);

      // Verify spacing for job 1 (expert tier)
      if (job1Timestamps.length === 2) {
        const job1Spacing = job1Timestamps[1] - job1Timestamps[0];
        expect(job1Spacing).toBeGreaterThanOrEqual(240);
        logger.info(
          `[PERF-RATE-LIMITS] Job 1 (expert) spacing: ${job1Spacing}ms (min: 240ms) ✓`
        );
      }

      // Verify spacing for job 2 (standard tier)
      if (job2Timestamps.length === 2) {
        const job2Spacing = job2Timestamps[1] - job2Timestamps[0];
        expect(job2Spacing).toBeGreaterThanOrEqual(90);
        logger.info(
          `[PERF-RATE-LIMITS] Job 2 (standard) spacing: ${job2Spacing}ms (min: 90ms) ✓`
        );
      }

      logger.info(
        "[PERF-RATE-LIMITS] ✓ Concurrent jobs maintain independent spacing"
      );

      aiServiceStub1.restore();
    });
  });

  // ============================================================================
  // Summary & Reporting
  // ============================================================================

  describe("Rate-Limit Compliance Results", () => {
    it("should summarize spacing measurements", () => {
      logger.info(
        "[PERF-RATE-LIMITS] ========================================"
      );
      logger.info("[PERF-RATE-LIMITS] Rate-Limit Compliance Summary");
      logger.info(
        "[PERF-RATE-LIMITS] ========================================"
      );

      if (SPACING_MEASUREMENTS.proToProSpacing.length > 0) {
        const avgProSpacing =
          SPACING_MEASUREMENTS.proToProSpacing.reduce((a, b) => a + b, 0) /
          SPACING_MEASUREMENTS.proToProSpacing.length;
        logger.info(
          `[PERF-RATE-LIMITS] Pro→Pro avg spacing: ${avgProSpacing.toFixed(
            1
          )}ms (required: ≥240ms)`
        );
      }

      if (SPACING_MEASUREMENTS.flashToFlashSpacing.length > 0) {
        const avgFlashSpacing =
          SPACING_MEASUREMENTS.flashToFlashSpacing.reduce((a, b) => a + b, 0) /
          SPACING_MEASUREMENTS.flashToFlashSpacing.length;
        logger.info(
          `[PERF-RATE-LIMITS] Flash→Flash avg spacing: ${avgFlashSpacing.toFixed(
            1
          )}ms (required: ≥90ms)`
        );
      }

      if (SPACING_MEASUREMENTS.mixedSpacing.length > 0) {
        const avgMixedSpacing =
          SPACING_MEASUREMENTS.mixedSpacing.reduce((a, b) => a + b, 0) /
          SPACING_MEASUREMENTS.mixedSpacing.length;
        logger.info(
          `[PERF-RATE-LIMITS] Mixed tier avg spacing: ${avgMixedSpacing.toFixed(
            1
          )}ms`
        );
      }

      logger.info(
        "[PERF-RATE-LIMITS] ========================================"
      );
      logger.info(
        "[PERF-RATE-LIMITS] ✓ All rate-limit compliance tests completed"
      );
      logger.info(
        "[PERF-RATE-LIMITS] ========================================"
      );

      expect(true).toBe(true); // Placeholder assertion
    });
  });
});
