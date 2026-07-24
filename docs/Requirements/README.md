# Habitus Requirements Catalog

This folder is the catalog surface for Habitus requirements and the file-based source of truth for the current catalog.

The current browser view remains [index.html](index.html), but the target structure is to separate:

- requirement statements,
- design artefacts,
- diagrams,
- implementation references,
- verification evidence.

That separation aligns better with ISO/IEC 12207 development activities than a single large JavaScript array.

## Current Catalog

- [index.html](index.html) renders the filterable catalog and loads requirement artifacts through the manifest.
- [catalog-manifest.json](catalog-manifest.json) is the index of requirement files and associated diagrams.
- [scripts/build-catalog.mjs](scripts/build-catalog.mjs) is an optional generator for derived catalog output.
- [scripts/serve-catalog.mjs](scripts/serve-catalog.mjs) starts a local HTTP server for opening the catalog in a browser.
- [traceability/diagram-coverage.md](traceability/diagram-coverage.md) tracks requirement-to-diagram coverage for review.
- [requirements-data.js](requirements-data.js) is legacy and no longer used by the browser view.

### Open the catalog

Open the catalog through a local server, not with `file://`.

```bash
node docs/Requirements/scripts/serve-catalog.mjs
```

Then open the URL printed by the script. This works normally from WSL as long as the browser can reach `localhost`.

## Target Structure

Recommended layout for the next iteration:

- `requirements/stakeholder-needs/` for business and user needs.
- `requirements/system-requirements/` for testable system requirements.
- `requirements/architecture/` for architecture-level decisions and constraints.
- `requirements/verification/` for test and validation requirements.
- `diagrams/use-cases/` for use case diagrams.
- `diagrams/classes/` for class diagrams.
- `diagrams/sequences/` for sequence diagrams.
- `traceability/` for machine-readable links between requirement, design, implementation, and tests.

The catalog UI now reads requirement files directly from the manifest, so the view model is derived from the file tree instead of being manually maintained in a large array.

## Schema

Each requirement file carries: `id`, `title`, `type` (Functional/Non-Functional), `module`, `priority`, `status`, `description`, `acceptanceCriteria`, `roles`, `relatedRequirements`, `designRefs`, `diagramRefs`, `implementationRefs`, `testRefs`, and an optional inline `diagram` fallback for Mermaid syntax.

`diagramRefs` is preferred for external use-case, class, or sequence diagrams.

## Maintaining Traceability

- Add new requirements before implementation starts.
- Keep `designRefs`, `implementationRefs`, and `testRefs` explicit, even if they are temporarily empty.
- Prefer `designRefs` that point to diagrams derived from current C# controllers/services instead of historical draft docs.
- Prefer external diagram files for structural diagrams, keeping inline Mermaid only as a fallback.
- Do not delete a requirement; mark it `Deprecated` instead to preserve history.
