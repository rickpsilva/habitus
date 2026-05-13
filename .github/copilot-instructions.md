# Habitus Copilot Instructions

Use the smallest safe change that solves the requested task.

## Repository overview

- Backend: .NET 8 solution under `/src` with tests in `/tests`.
- Frontend: React + TypeScript + Vite app under `/src/habitus-web`.
- UI copy is primarily written in Portuguese (`pt-PT`).

## Validation

- Backend tests: `dotnet test src/Habitus.slnx --nologo`
- Frontend lint: `cd src/habitus-web && npm run lint`
- Frontend build: `cd src/habitus-web && npm run build`

## Working style

- Reuse existing pages, shared components, and API service helpers before adding new abstractions.
- Keep frontend behavior aligned with existing route/page/service patterns.
- Prefer targeted validation for the files you changed, then run the relevant existing checks.

For frontend-specific implementation details, also follow `.github/instructions/habitus-web.instructions.md`.
