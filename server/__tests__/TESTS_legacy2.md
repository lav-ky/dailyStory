# Test Failures Summary - Legacy & Failing Tests

**Date:** December 22, 2025  @ 12:00PM
**Branch:** `PERF-VALIDATE`

## Summary

This document tracks tests that are currently failing and need to be marked as `.skip` or fixed. Reference the companion document `TESTS_REF_DEC25.md` for complete test documentation.

**Current Test Results:**

- Test Files: 7 failed | 66 passed | 1 skipped (74)
- Tests: 51 failed | 729 passed | 7 skipped (787)
- Errors: 1 unhandled error during test run

---

## Failing Tests

### 1. Phase 2 Service Integration (`phase2-service-integration.test.js`) - 14 FAILURES

**Root Cause:** `Error: Generation failed: logger.info is not a function`

**Affected Tests:**

- should process payload with classification parameter
- should include classification in metadata when provided
- should route correctly based on mode parameter
- should include metadata with mode and timestamp
- should include resultId for future reference
- should handle auto-classification when mode is 'auto'
- should handle classification flag for testing
- should generate unique resultIds for each generation
- should preserve classification style in metadata
- should return valid response structure
- should handle different mediums with classification
- should process generation for override workflow (Override System Integration suite)
- should still support existing process() calls without classification (Backward Compatibility suite)
- should handle undefined classification parameter (Backward Compatibility suite)
- should work with all existing modes (Backward Compatibility suite)
- should return complete response envelope (Response Schema Validation suite)
- should include classification in metadata when provided (Response Schema Validation suite)

**Issue:** The genieService's process method is failing because `logger.info` is not properly initialized/mocked in test context. The error occurs at `genieService.js:1069:17` during error handling.

**Recommendation:** Mark test file with `.skip` suffix → `phase2-service-integration.test.js.skip`

---

### 2. Genie Reservation Integration (`genie_reservation.integration.test.mjs`) - 1 UNHANDLED ERROR

**Root Cause:** `Error: Generation failed: logger.info is not a function`

**Issue:** Same root cause as phase2 tests - unhandled rejection during test execution. The error originated in this file's context during test runs.

**Recommendation:** Mark test file with `.skip` suffix → `genie_reservation.integration.test.mjs.skip`

---

### 3. E2E Performance Tests (`e2e-performance.test.js`) - Multiple Service Errors

**Root Cause:** Multiple issues:

1. `[SERVICE] [ebookService] Error:` - ebookService failing silently
2. Potential logger initialization issues similar to phase2 tests
3. Gemini API errors: `[GoogleGenerativeAI Error]: models/gemini-pro is not found for API version v1beta`

**Affected Suites:**

- Performance and Load Testing > Single Request Performance
- Performance and Load Testing > Concurrent Request Handling

**Issues:**

- Ebook generation errors not properly logged
- Poster generation appears to pass (~34ms)
- LLM classification failing with Gemini API 404 errors
- Auto-classification falling back to rules engine

**Recommendation:** Mark test file with `.skip` suffix → `e2e-performance.test.js.skip`

---

## Known Issues Requiring Investigation

### Issue 1: Logger Initialization in genieService

**File:** `server/genieService.js:1069:17`  
**Problem:** `logger.info is not a function` suggests the logger is undefined or incorrectly mocked in test contexts.  
**Impact:** Blocks 14+ tests in phase2-service-integration.test.js  
**Next Steps:**

1. Verify logger mock setup in test initialization
2. Check if logger is properly injected into genieService in test setup
3. Ensure test fixtures properly initialize the logger module

### Issue 2: ebookService Silent Failures

**File:** `server/ebookService.js` (likely)  
**Problem:** `[SERVICE] [ebookService] Error:` logged without error details  
**Impact:** Blocks e2e-performance tests  
**Next Steps:**

1. Add detailed error logging to ebookService error handler
2. Debug test setup for ebookService initialization
3. Verify mock AI service is properly wired

### Issue 3: Gemini API Deprecation

**File:** LLM classification endpoint  
**Problem:** `models/gemini-pro is not found for API version v1beta`  
**Impact:** Auto-classification tests fail with 404  
**Next Steps:**

1. Update Gemini API client to use supported model versions
2. Check API key and version configuration in test environment
3. Ensure fallback to rules engine works correctly

---

## Legacy Format Tests (From TESTS_legacy.md)

These tests use outdated data formats and should also be reviewed:

- `export.legacy-title-body.test.js` - Legacy `{ title, body }` format
- `export.title-body.test.js` - Direct title/body parameters
- `export.persisted.integration.test.js` - Legacy content structure
- `preview.test.mjs` - `{ title, body }` payload
- `preview.integration.test.js` - Title/body in HTML validation
- `test-previewTemplate.js` - Multiple `{ title, body }` test cases
- `coreFlow.integration.test.js` - Legacy content format in flow
- `genieService.persistence.await.test.mjs` - `{ content: { title, body } }`
- `genieService.phase3.test.mjs` - Legacy content structure
- `genieService.getPersistedContent.test.mjs` - Legacy content retrieval

See `TESTS_legacy.md` for migration details.

---

## Action Items

- [ ] Fix logger initialization in test setup for phase2-service-integration tests
- [ ] Debug ebookService error handling and add detailed error logging
- [ ] Update Gemini API client to use current v1.5 models instead of deprecated v1beta
- [ ] Consider marking all failing tests with `.skip` suffix temporarily
- [ ] Create issues for each root cause to track fixes
- [ ] Update CI configuration to skip flaky tests in PERF-VALIDATE branch
- [ ] Document test setup requirements for new tests to avoid logger issues

---

## References

- Reference test documentation: [TESTS_REF_DEC25.md](TESTS_REF_DEC25.md)
- Legacy test migration guide: [TESTS_legacy.md](TESTS_legacy.md)
- Test directory README: [README.md](README.md)
