# Habitus Web Instructions

Apply these instructions when changing files under `/src/habitus-web`.

## Stack and structure

- React 19 + TypeScript + Vite.
- Routes are declared in `src/habitus-web/src/App.tsx`.
- API access should go through `src/habitus-web/src/api/services.ts`.
- Shared UI building blocks live in `src/habitus-web/src/components`.
- Page-level features live in `src/habitus-web/src/pages`.

## Implementation guidelines

- Match the existing functional-component and hook-based style.
- Keep text and labels in Portuguese unless the surrounding UI is already English.
- Prefer extending existing DTOs and service methods instead of bypassing the typed API layer.
- Reuse existing modal, pagination, search, toast, and confirmation components when possible.
- Avoid adding dependencies unless they are required for the task.

## Validation

- Run `npm run lint` and/or `npm run build` from `src/habitus-web` for frontend changes.
