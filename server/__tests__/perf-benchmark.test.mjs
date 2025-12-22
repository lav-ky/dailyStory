import { describe, it, beforeAll, afterEach, expect } from "vitest";
import request from "supertest";
import { app, logger } from "../index.js";
import { smartPoller } from "../utilities/smartPoller.js";

/**
 * PERF-VALIDATE: Performance Benchmarking Suite
 *
 * Measures end-to-end latency from PART-A POST request through polling
 * to completion. Verifies that requests complete within target timeframes.
 *
 * Date: December 22, 2025
 * Branch: PERF-VALIDATE
 */

describe("PERF-VALIDATE: Performance Benchmarking", () => {
  const RESULTS = {
    tests: [],
  };

  // Helper: Measure end-to-end latency with polling
  async function measureEbookGeneration(prompt, pageCount, targetTime) {
    const startTotal = Date.now();

    // PART-A: POST request (should return immediately)
    const postStart = Date.now();
    const postRes = await request(app).post("/api/ebook/generate").send({
      prompt,
      theme: "dark",
      pageCount,
    });
    const postElapsed = Date.now() - postStart;

    expect(postRes.status).toBe(202);
    expect(postRes.body.resultId).toBeDefined();
    expect(postElapsed).toBeLessThan(150); // PART-A should be <150ms

    const resultId = postRes.body.resultId;
    const eta = postRes.body.eta; // ETA from first call

    logger.info(
      `[PERF-BENCHMARK] Job ${resultId} started. ETA: ${eta}s, PART-A latency: ${postElapsed}ms`
    );

    // Smart polling strategy: wait 80% of ETA, then poll every 500ms
    const waitTime = Math.floor(eta * 1000 * 0.8);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(waitTime, 500))
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
        logger.info(
          `[PERF-BENCHMARK] Job ${resultId} completed. Status: ${status.status}, Polls: ${pollCount}`
        );
        break;
      }

      if (status.status === "error") {
        throw new Error(`Job failed: ${status.error}`);
      }

      // Poll every 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Safety timeout: 2x target time
      const elapsed = Date.now() - pollStartTime;
      if (elapsed > targetTime * 2) {
        throw new Error(
          `Job exceeded 2x target time (${
            targetTime * 2
          }ms). Elapsed: ${elapsed}ms`
        );
      }
    }

    const totalElapsed = Date.now() - startTotal;

    // Results summary
    const result = {
      testName: `${pageCount}-page ebook`,
      prompt: prompt.substring(0, 50),
      targetTime,
      actualTime: totalElapsed,
      partALatency: postElapsed,
      eta,
      pollCount,
      accuracy: Math.abs(eta - totalElapsed / 1000) / eta,
      passed: totalElapsed < targetTime,
    };

    RESULTS.tests.push(result);

    logger.info(
      `[PERF-BENCHMARK] ✓ ${
        result.testName
      }: ${totalElapsed}ms (target: ${targetTime}ms, ${
        result.passed ? "PASS" : "FAIL"
      })`
    );

    return {
      resultId,
      elapsed: totalElapsed,
      eta,
      result: status.result,
      accuracy: result.accuracy,
    };
  }

  beforeAll(() => {
    logger.info(
      "[PERF-BENCHMARK] Starting performance benchmarking suite (PERF-VALIDATE phase)"
    );
  });

  afterEach(() => {
    // Results logged per test
  });

  // ============================================================================
  // BENCHMARK TESTS: Single Requests
  // ============================================================================

  describe("Single Request Performance", () => {
    it("should complete 3-page ebook in < 30 seconds", async function () {
      this.timeout(35000); // Allow 35s for execution + overhead

      const result = await measureEbookGeneration(
        "Write a comprehensive 3-page ebook about sustainable energy solutions and their practical implementation",
        3,
        30000 // 30 second target
      );

      expect(result.elapsed).toBeLessThan(30000);
      logger.info(
        `[PERF-BENCHMARK] 3-page completion: ${
          result.elapsed
        }ms, ETA accuracy: ${(result.accuracy * 100).toFixed(1)}%`
      );
    });

    it("should complete 10-page ebook in < 50 seconds", async function () {
      this.timeout(55000); // Allow 55s for execution + overhead

      const result = await measureEbookGeneration(
        "Write a detailed 10-page ebook covering machine learning fundamentals, algorithms, practical applications, and industry best practices for implementation",
        10,
        50000 // 50 second target
      );

      expect(result.elapsed).toBeLessThan(50000);
      logger.info(
        `[PERF-BENCHMARK] 10-page completion: ${
          result.elapsed
        }ms, ETA accuracy: ${(result.accuracy * 100).toFixed(1)}%`
      );
    });

    it("should complete wall-art generation in < 15 seconds", async function () {
      this.timeout(20000);

      const startTotal = Date.now();

      const postRes = await request(app).post("/api/wall-art/generate").send({
        prompt: "Create contemporary abstract wall art in vibrant colors",
        style: "modern",
      });

      expect(postRes.status).toBe(202);
      const resultId = postRes.body.resultId;
      const postElapsed = Date.now() - startTotal;

      // Poll for completion
      let status;
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusRes = await request(app).get(`/api/status/${resultId}`);
        status = statusRes.body;

        if (status.status === "complete" || status.status === "error") {
          break;
        }

        const elapsed = Date.now() - startTotal;
        if (elapsed > 30000) {
          throw new Error("Wall art generation timeout");
        }
      }

      const totalElapsed = Date.now() - startTotal;
      expect(totalElapsed).toBeLessThan(15000);

      RESULTS.tests.push({
        testName: "wall-art generation",
        targetTime: 15000,
        actualTime: totalElapsed,
        passed: totalElapsed < 15000,
      });

      logger.info(
        `[PERF-BENCHMARK] Wall art: ${totalElapsed}ms (target: 15000ms, ${
          totalElapsed < 15000 ? "PASS" : "FAIL"
        })`
      );
    });
  });

  // ============================================================================
  // BENCHMARK TESTS: Concurrent Requests
  // ============================================================================

  describe("Concurrent Request Performance", () => {
    it("should handle 2 concurrent 3-page requests within target time", async function () {
      this.timeout(40000);

      logger.info(
        "[PERF-BENCHMARK] Starting 2 concurrent 3-page requests benchmark"
      );

      const startTotal = Date.now();

      // Send both requests concurrently
      const promises = [
        request(app).post("/api/ebook/generate").send({
          prompt: "Write a 3-page ebook about renewable energy",
          theme: "dark",
          pageCount: 3,
        }),
        request(app).post("/api/ebook/generate").send({
          prompt: "Write a 3-page ebook about climate change mitigation",
          theme: "light",
          pageCount: 3,
        }),
      ];

      const postResults = await Promise.all(promises);
      const postElapsed = Date.now() - startTotal;

      expect(postResults[0].status).toBe(202);
      expect(postResults[1].status).toBe(202);

      const resultIds = [
        postResults[0].body.resultId,
        postResults[1].body.resultId,
      ];

      logger.info(
        `[PERF-BENCHMARK] Both requests accepted in ${postElapsed}ms. Polling for completion...`
      );

      // Poll both concurrently
      const completed = await Promise.all(
        resultIds.map(async (resultId) => {
          let status;
          let pollCount = 0;

          while (true) {
            pollCount++;
            const statusRes = await request(app).get(`/api/status/${resultId}`);
            status = statusRes.body;

            if (status.status === "complete") {
              break;
            }

            if (status.status === "error") {
              throw new Error(`Job ${resultId} failed: ${status.error}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 500));

            if (pollCount > 120) {
              // 60 second timeout
              throw new Error(`Job ${resultId} timeout`);
            }
          }

          return { resultId, status, pollCount };
        })
      );

      const totalElapsed = Date.now() - startTotal;

      expect(totalElapsed).toBeLessThan(40000);
      logger.info(
        `[PERF-BENCHMARK] Both concurrent requests completed in ${totalElapsed}ms (target: 40000ms, PASS)`
      );

      RESULTS.tests.push({
        testName: "2x concurrent 3-page ebook",
        targetTime: 40000,
        actualTime: totalElapsed,
        passed: totalElapsed < 40000,
      });
    });

    it("should handle 5 concurrent 3-page requests sequentially within reasonable time", async function () {
      this.timeout(90000); // 90 second timeout for 5 sequential requests

      logger.info("[PERF-BENCHMARK] Starting 5 concurrent 3-page requests");

      const startTotal = Date.now();

      // Send all 5 requests
      const prompts = [
        "Write a 3-page ebook about artificial intelligence",
        "Write a 3-page ebook about blockchain technology",
        "Write a 3-page ebook about quantum computing",
        "Write a 3-page ebook about edge computing",
        "Write a 3-page ebook about cybersecurity",
      ];

      const postResults = await Promise.all(
        prompts.map((prompt) =>
          request(app).post("/api/ebook/generate").send({
            prompt,
            theme: "dark",
            pageCount: 3,
          })
        )
      );

      postResults.forEach((res) => {
        expect(res.status).toBe(202);
      });

      const resultIds = postResults.map((r) => r.body.resultId);
      const postElapsed = Date.now() - startTotal;

      logger.info(
        `[PERF-BENCHMARK] All 5 requests accepted in ${postElapsed}ms. Polling...`
      );

      // Poll all concurrently
      const completed = await Promise.all(
        resultIds.map(async (resultId) => {
          let status;

          while (true) {
            const statusRes = await request(app).get(`/api/status/${resultId}`);
            status = statusRes.body;

            if (status.status === "complete") {
              break;
            }

            if (status.status === "error") {
              throw new Error(`Job ${resultId} failed: ${status.error}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          return { resultId, completed: true };
        })
      );

      const totalElapsed = Date.now() - startTotal;

      expect(completed.length).toBe(5);
      logger.info(
        `[PERF-BENCHMARK] All 5 concurrent requests completed in ${totalElapsed}ms`
      );

      RESULTS.tests.push({
        testName: "5x concurrent 3-page ebook",
        targetTime: 90000,
        actualTime: totalElapsed,
        passed: totalElapsed < 90000,
      });
    });
  });

  // ============================================================================
  // SUMMARY & REPORTING
  // ============================================================================

  describe("Performance Results Summary", () => {
    it("should report benchmark results", async () => {
      logger.info("[PERF-BENCHMARK] ========================================");
      logger.info("[PERF-BENCHMARK] Performance Benchmark Results Summary");
      logger.info("[PERF-BENCHMARK] ========================================");

      const passed = RESULTS.tests.filter((t) => t.passed).length;
      const total = RESULTS.tests.length;

      RESULTS.tests.forEach((test) => {
        const status = test.passed ? "✓ PASS" : "✗ FAIL";
        const overhead =
          test.actualTime - test.targetTime > 0
            ? `+${test.actualTime - test.targetTime}ms`
            : `${test.actualTime - test.targetTime}ms`;

        logger.info(
          `[PERF-BENCHMARK] ${status} | ${test.testName}: ${test.actualTime}ms (target: ${test.targetTime}ms, ${overhead})`
        );
      });

      logger.info("[PERF-BENCHMARK] ========================================");
      logger.info(
        `[PERF-BENCHMARK] Summary: ${passed}/${total} tests passed (${Math.round(
          (passed / total) * 100
        )}%)`
      );
      logger.info("[PERF-BENCHMARK] ========================================");

      // Assertion: at least 80% of benchmarks should pass
      expect(passed).toBeGreaterThanOrEqual(Math.ceil(total * 0.8));
    });
  });
});
