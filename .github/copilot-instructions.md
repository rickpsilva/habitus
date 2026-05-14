# Copilot Instructions for Habitus

When implementing changes in this repository:

- Keep changes minimal and scoped to the requested feature/fix.
- Preserve the existing architecture (`Habitus.Domain`, `Habitus.Application`, `Habitus.Infrastructure`, `Habitus.Api`, `habitus-web`).
- Prefer existing services, DTOs, and patterns over introducing new abstractions.
- For backend validation, run:
  - `dotnet test src/Habitus.slnx --nologo`
- For frontend validation (when frontend code changes), run in `src/habitus-web`:
  - `npm install`
  - `npm run lint`
  - `npm run build`
- Do not commit secrets or environment-specific credentials.
