# Green Tests Documentation

**Date:** December 22, 2025  
**Branch:** PERF-VALIDATE  
**Status:** 729 Passing Tests | 51 Failing (Legacy) | 7 Skipped

---

**Note:** This document lists only passing/green tests. Legacy failing tests are documented in `TESTS_legacy2.md` and should remain skipped.

## Core Business Logic (Passing)

- **HTTP Concurrency** (`concurrency.http.integration.test.mjs`): Validates concurrent prompt creation endpoints preserve upsert semantics.
- **HTTP Concurrency Integration** (`concurrency.integration.test.mjs`): Tests parallel request handling with concurrent request deduplication.
- **AI Mock Response** (`aiMockResponse.test.mjs`): Confirms mock AI service generates consistent single-page responses.
- **Prompt API** (`prompt.test.js`): Validates prompt CRUD operations, validation, and state management.
- **Jobs Management** (`jobs.test.mjs`): Tests job queue operations and state transitions.
- **Worker Processing** (`worker.test.mjs`): Validates SQLite worker job finalization and error handling.
- **DB Utils** (`dbUtils.test.mjs`): Tests database utility functions.
- **DB Utils Upsert** (`dbUtils.upsert.test.mjs`): Validates upsert-specific database operations.
- **Close Services** (`closeServices.test.js`): Ensures graceful shutdown and resource cleanup.
- **Job Requeuing** (`jobs.requeue.test.mjs`): Validates stale job requeuing on service startup.

---

## Service Integration (Passing)

- **Genie Service Base Persistence** (`genieService.persistence.test.mjs`): Tests caching behavior and read-only lookups.
- **Genie Service Deduplication** (`genieService.persistence.dedupe.test.mjs`): Validates response deduplication in persistence layer.
- **Genie Service Await** (`genieService.persistence.await.test.mjs`): Tests async result waiting mechanisms.
- **Genie Idempotency** (`genie_idempotency.integration.test.mjs`): Ensures idempotent request handling.
- **Genie Export** (`genieExport.test.mjs`): Validates export functionality from genie service.
- **Genie Persistence** (`geniePersistence.test.js`): Tests persistence layer behavior.
- **Genie Router** (`genieRouter.test.js`): Validates routing logic in genie service.
- **Genie Service Classify Prompt** (`genieService.classifyPrompt.test.js`): Tests prompt classification logic.
- **Genie Service Compose** (`genieService.compose.test.js`): Validates content composition from persisted results.
- **Genie Service Get Persisted Content** (`genieService.getPersistedContent.test.mjs`): Tests content retrieval from persistence.
- **Genie Service Integration** (`genieService.integration.test.js`): End-to-end genie service workflow validation.
- **Genie Service Phase 3** (`genieService.phase3.test.mjs`): Tests phase 3 service operations.
- **Override Service** (`overrideService.test.js`): Validates content override functionality.
- **Override System** (`overrideSystem.test.js`): Tests override system integration.

---

## Demo & Sample Services (Passing)

- **Demo Service** (`demo-demoService.test.js`): Tests demo mode service operations.
- **Demo Epilogue Generator** (`demo-epilogueGenerator.test.js`): Validates epilogue generation in demo mode.
- **Demo Image Generation** (`demo-imageGeneration.test.js`): Tests image generation in demo mode.
- **Demo Mode Integration** (`demo-mode.integration.test.js`): End-to-end demo mode workflow.
- **Demo PDF Structure** (`demo-pdfStructure.test.js`): Validates PDF structure in demo mode.
- **Demo Theme Engine** (`demo-themeEngine.test.js`): Tests theme engine for demo mode.
- **Sample Service** (`sampleService.spec.js`): Tests sample service operations.

---

## Image Generation (Passing)

- **Image Generator** (`imageGenerator.test.mjs`): Tests offline image generation and poem background creation.
- **Image Generator Raster** (`imageGenerator.raster.test.mjs`): Validates raster image generation pipelines.
- **Image Generator Gemini** (`imageGenerator.gemini.test.mjs`): Tests Gemini AI integration with fallback behavior.
- **Image Validation** (`imageValidation.test.mjs`): Validates image formats and constraints.
- **Image Service** (`imageService.test.js`): Tests image service operations.

---

## Export & PDF (Passing)

- **Export Smoke Tests** (`export_smoke.test.mjs`): Quick validation of basic export functionality.
- **Export** (`export.test.js`): Tests export endpoint and response formats.
- **Export Text** (`export_text.test.mjs`): End-to-end PDF export with text extraction verification.
- **Export Text** (`export_text.test.js`): Validates exported text content.
- **Export Handler** (`export-handler.test.js`): Tests export endpoint request handling and edge cases.
- **PDF Generator** (`pdfGenerator.test.mjs`): Unit tests for PDF generation utilities and formatting.
- **PDF Quality** (`pdfQuality.integration.test.mjs`): Integration tests for PDF rendering and metadata.
- **PDF Quality** (`pdf_quality.test.mjs`): Validates PDF quality standards.
- **Puppeteer Smoke Test** (`puppeteer.smoke.test.js`): Smoke tests for Puppeteer-driven PDF generation.
- **Test Puppeteer PDF** (`test-puppeteer-pdf.js`): Functional verification of Puppeteer PDF flow.

---

## Content Processing (Passing)

- **Content Chunker** (`contentChunker.test.js`): Tests content splitting and chunking logic.
- **Classification Validator** (`classificationValidator.test.js`): Validates content classification logic.
- **LLM Classifier** (`llmClassifier.test.js`): Tests LLM-based classification functionality.
- **Normalize Prompt** (`normalizePrompt.test.mjs`): Validates prompt normalization and standardization.
- **Page Layout** (`pageLayout.test.js`): Tests page layout computation and validation.
- **Rule Engine** (`ruleEngine.test.js`): Validates rules-based classification fallback.
- **TOC Generator** (`tocGenerator.test.js`): Tests table of contents generation.
- **SVG Library** (`svgLibrary.test.js`): Validates SVG rendering utilities.
- **Theme Engine** (`themeEngine.test.js`): Tests theme application and styling.
- **Keyword Database** (`keywordDatabase.test.js`): Validates keyword lookup and storage.

---

## E2E & Workflow Tests (Passing)

- **E2E Full Workflow** (`e2e-full-workflow.test.js`): End-to-end complete user workflow from prompt to export.
- **E2E Error Scenarios** (`e2e-error-scenarios.test.js`): Tests error handling across full workflows.
- **E2E Worker** (`e2e.worker.test.mjs`): Tests worker-based async processing end-to-end.
- **Phase 2 Orchestrator Integration** (`phase2-orchestrator-integration.test.mjs`): Tests phase 2 orchestration workflow.
- **Phase 3 Queue** (`phase-3-queue.test.js`): Validates job queue operations in phase 3.
- **Worker Integration** (`worker-integration.test.mjs`): Tests worker service integration.

---

## Quota & Rate Limiting (Passing)

- **Quota Tracker** (`quotaTracker.test.js`): Tests quota allocation and enforcement.
- **Quota Integration** (`quota-integration.test.js`): End-to-end quota system validation.
- **Quota Error Handling** (`quota-error-handling.test.js`): Tests quota exhaustion error cases.

---

## E-Book Service (Passing)

- **EBook Service Unit** (`ebookService.unit.test.js`): Unit tests for e-book generation.
- **EBook Service Integration** (`ebookService.integration.test.js`): Integration tests for e-book workflows.
- **EBook Service Legacy** (`ebookService.legacy.test.js`): Tests legacy e-book format support.
- **EBook Service NAT-CONT** (`ebookService.nat-cont.test.js`): Tests narrative continuity pipeline for e-books.

---

## Actions & Routing (Passing)

- **Actions Flow** (`actions.flow.test.mjs`): Tests action flow and command routing.

---

## Summary

**Total Green Tests:** 729 passing tests across 66 test files  
**Test Framework:** Vitest  
**Run Command:** `cd server && npm test` (watch) or `npm run test:run` (CI)

**Note:** Legacy failing tests documented in `TEST_legacy2.md`. These represent the environment's evolution and should remain skipped.

**Last Updated:** December 22, 2025 | **Branch:** PERF-VALIDATE
