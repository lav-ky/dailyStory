# Test Documentation (Consolidated)

**Date:** December 22, 2025  @ 12:00PM
**Branch:** `PERF-VALIDATE`

This document consolidates all tests found under `server/__tests__`.

**Note:** This is a living document and must reflect the current state of tests. Please update as new tests are added or existing ones are modified. (Last updated: November 7, 2025)

> ERROR: Test failure observed
>
> - Failing test: `server/__tests__/aiService.test.js` → "API: /prompt (AI Processing Layer)" → should return a structured AI response for a valid prompt
> - What failed: the test posted a prompt and received promptId/resultId, but a subsequent GET to `/api/prompts/:promptId` returned 404 instead of 200. The assertion expected a 200 OK and the stored prompt's data to match the original prompt.
> - Possible cause: mixed persistence backends — the writer used the Prisma-backed `utils/dbUtils` (or another DB client) to create the prompt/result while the API GET handler used the legacy sqlite `crud` layer to read the prompt. This results in the POST and GET hitting different stores, so the GET cannot find the newly-created row.
>
> Recommended diagnostics:
>
> 1. Confirm which persistence implementation was used during the failing test (look for logs from `defaultModule` / `genieService` that indicate whether `utils/dbUtils` or `crud` was resolved).
> 2. Re-run the test with `GENIE_PERSISTENCE_ENABLED` and `USE_PRISMA_IN_TEST` toggled to see whether forcing the legacy `crud` backend makes the GET succeed.
> 3. As a longer-term fix, ensure read endpoints prefer `utils/dbUtils` when available or implement a unified persistence adapter so reads and writes use the same store.

## Table of Contents

- Core Business Logic Tests (8 tests)
- Service Integration Tests (6 tests)
- Image Generation Tests (4 tests)
- Export and PDF Tests (8 tests)
- E2E Tests (1 test)

---

## Core Business Logic Tests

### HTTP Concurrency (`concurrency.http.integration.test.mjs`)

Purpose: Tests concurrent HTTP request handling, particularly for prompt creation endpoints.

Highlights:

- Tests parallel POST requests to `/prompt` endpoint
- Validates upsert semantics in Postgres database
- Ensures at most one prompt row is created for concurrent identical requests
- Tests health endpoint reliability

Dependencies: `vitest`, `supertest`, `Prisma`

Run:

```
cd server
npx vitest run __tests__/concurrency.http.integration.test.mjs --run
```

Note: Requires DATABASE_URL environment variable to be set for Postgres testing.

---

### AI Mock Response (`aiMockResponse.test.mjs`)

Purpose: Validates the mock AI response generation utility used in testing.

Highlights:

- Tests default single-page response generation
- Validates page count limits
- Ensures consistent response structure

Run:

```
cd server
npx vitest run __tests__/aiMockResponse.test.mjs --run
```

---

### Prompt API (`prompt.test.js`)

Purpose: Validate prompt CRUD + validation + state management.

Highlights:

- Tests create/read/update/delete prompts
- Validates input validation and error states
- Ensures cleanup restores DB state

Dependencies: `vitest`, `supertest`.

Run:

```
cd server
npm run test:run -- prompt.test.js
```

---

### Core Flow (`coreFlow.integration.test.js`)

Purpose: End-to-end flow testing prompt -> preview -> export pipeline.

Highlights:

- Validates complete user interaction flow

Dependencies: `vitest`, `supertest`.

Run:

```
cd server
npm run test:run -- coreFlow.integration.test.js
```

---

### Preview Generation (`preview.test.js`)

Purpose: Tests preview generation endpoints and validates HTML rendering for various content types.

---

### Preview Integration (`preview.integration.test.js`)

Purpose: End-to-end integration tests for the preview functionality.

Highlights:

- Tests complete preview generation pipeline
- Validates preview rendering with real data
- Tests preview caching behavior
- Ensures proper error handling in integration scenarios

Run:

```
cd server
npm run test:run -- preview.integration.test.js
```

---

### Jobs Management (`jobs.test.mjs`)

Purpose: Tests job queue operations and validates job state transitions.

Run:

```
cd server
npx vitest run __tests__/jobs.test.mjs --run
```

---

### Worker Processing (`worker.test.mjs`)

Purpose: Tests SQLite worker job processing and validates job finalization and error handling.

Run:

```
cd server
npx vitest run __tests__/worker.test.mjs --run
```

---

## Service Integration Tests

### AI Service (`aiService.test.js`)

Purpose: Validate the AI service abstraction (`MockAIService`) behavior and integration with prompt/AI result storage.

Highlights:

- Validates structured AI response (content + metadata)
- Tests error cases (empty/invalid prompts)
- Verifies DB storage of prompt/result pairs

Run:

```
cd server
npm run test:run -- aiService.test.js
```

---

### Genie Service Base Persistence (`genieService.persistence.test.mjs`)

Purpose: Tests the basic persistence functionality of the Genie service.

Highlights:

- Tests caching behavior with DB results
- Validates read-only lookup operations
- Tests fallback to generator when no cache exists
- Verifies correct service initialization and cleanup

Run:

```
cd server
npx vitest run __tests__/genieService.persistence.test.mjs --run
```

---

### Genie Service Await (`genieService.persistence.await.test.mjs`)

Purpose: Tests asynchronous waiting behavior in the Genie service persistence layer.

Highlights:

- Tests async result waiting mechanisms
- Validates timeout behavior
- Tests concurrent result fetching

Run:

```
cd server
npx vitest run __tests__/genieService.persistence.await.test.mjs --run
```

---

### Genie Service Deduplication (`genieService.persistence.dedupe.test.mjs`)

Purpose: Tests deduplication in the persistence layer and validates caching and response consistency.

Run:

```
cd server
npx vitest run __tests__/genieService.persistence.dedupe.test.mjs --run
```

---

### Service Lifecycle (`closeServices.test.js`)

Purpose: Tests graceful shutdown of service components and validates resource cleanup.

Run:

```
cd server
npm run test:run -- closeServices.test.js
```

---

### Job Requeuing (`jobs.requeue.test.mjs`)

Purpose: Tests job requeuing on service startup and validates stale job handling.

Run:

```
cd server
npx vitest run __tests__/jobs.requeue.test.mjs --run
```

---

## Image Generation Tests

### Core Image Generation (`imageGenerator.test.mjs`)

Purpose: Tests offline image generation capabilities and validates poem background creation.

---

### Raster Image Generation (`imageGenerator.raster.test.mjs`)

Purpose: Tests specific raster image generation functionality.

Highlights:

- Tests raster image generation pipelines
- Validates image dimensions and formats
- Tests different raster processing options
- Ensures proper error handling for raster operations

Run:

```
cd server
npx vitest run __tests__/imageGenerator.raster.test.mjs --run
```

---

### Gemini AI Integration (`imageGenerator.gemini.test.mjs`)

Purpose: Tests Gemini AI integration, validates fallback behavior, and verifies prompt generation.

Run:

```
cd server
npx vitest run __tests__/imageGenerator.gemini.test.mjs --run
```

---

### Image Validation (`imageValidation.test.mjs`)

Purpose: Validates image formats and constraints, and tests error handling for invalid inputs.

Run:

```
cd server
npx vitest run __tests__/imageValidation.test.mjs --run
```

---

## Export and PDF Tests

### Export Smoke Tests (`export_smoke.test.mjs`)

Purpose: Quick smoke tests for the export functionality to ensure basic operation.

Highlights:

- Validates basic export endpoint functionality
- Tests minimal export scenarios
- Ensures export process completes successfully

Run:

```
cd server
npx vitest run __tests__/export_smoke.test.mjs --run
```

---

### Export Endpoint Tests (`test-export-endpoint.js`)

Purpose: Comprehensive testing of the export endpoint functionality.

Highlights:

- Tests various export configurations
- Validates error handling
- Tests response formats and headers

Run:

```
cd server
npm run test:run -- test-export-endpoint.js
```

---

### Export Integration (`export.integration.test.js`)

Purpose: End-to-end verification of the `/export` endpoint using Puppeteer.

What it does:

- Starts the app programmatically (no network listen)
- Waits for `/health` to be `ok`
- Posts `{ title, body }` to `/export`
- Asserts a 200 response with `application/pdf` and a non-empty binary buffer

Dependencies: `vitest`, `supertest`, `puppeteer-core`, plus a system Chrome/Chromium or `CHROME_PATH` configured.

Run:

```
cd server
npm run test:run -- export.integration.test.js
```

CI note: The CI job must install a system Chrome/Chromium binary or set `CHROME_PATH`. See `.github/workflows/server-tests-pr.yml`.

---

### PDF Quality (`pdfQuality.integration.test.mjs`)

Purpose: Integration tests for PDF quality, validates content rendering, and tests PDF metadata and structure.

Run:

```
cd server
npx vitest run __tests__/pdfQuality.integration.test.mjs --run
```

---

### Export Handler (`export-handler.test.js`)

Purpose: Tests export endpoint request handling and validates error cases and edge conditions.

Run:

```
cd server
npm run test:run -- export-handler.test.js
```

---

### Export Text Verification (`export_text.test.mjs`)

Purpose: End-to-end verification of the `/api/export/book` endpoint that asserts:

- The response is a valid PDF (magic bytes `%PDF-`).
- The extracted PDF text contains expected poem titles (uses `server/scripts/extract-pdf-text.js`).

What it does:

- Starts the app programmatically (no network listen), ensuring DB and Puppeteer are initialized.
- Posts to `/api/export/book` and captures the binary response.
- Writes the buffer to a temp file and calls `server/scripts/extract-pdf-text.js` to extract text for assertions.

Run:

```
cd server
npx vitest run __tests__/export_text.test.mjs --run
```

Notes:

- This test uses a subprocess to run the extraction script to avoid importing `pdf-parse` directly inside the test process (some versions run debug code on import).
- For CI, see the `verify-export` script in `server/package.json` which runs the smoke export and extraction.

---

### PDF Generator (`pdfGenerator.test.mjs`)

Purpose: Unit tests for PDF generation utilities, testing formatting and layout options.

Run:

```
cd server
npx vitest run __tests__/pdfGenerator.test.mjs --run
```

---

### Puppeteer PDF Flow (`test-puppeteer-pdf.js`)

Purpose: Functional verification that a Puppeteer-driven PDF flow creates a file and returns a buffer.

Run:

```
cd server
npm run test:run -- test-puppeteer-pdf.js
```

CI note: Requires Chrome/Chromium.

---

## E2E Tests

### Summer Poems Flow (`e2e.summer-poems.test.mjs`)

Purpose: Full export flow with stubbed AI services, testing deterministic poem generation and export, and validating the complete user journey.

Run:

```
cd server
npx vitest run __tests__/e2e.summer-poems.test.mjs --run
```

---

```markdown
## General Notes

- Tests run under Vitest
- Use `npm test` for interactive watch mode
- Use `npm run test:run` for CI-friendly runs
- Integration and Puppeteer-based tests need Chrome/Chromium
- Some tests can be gated behind environment variables for CI optimization

---

Last updated: November 7, 2025
```
