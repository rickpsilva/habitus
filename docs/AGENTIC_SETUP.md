# Agentic Setup for Habitus

This document defines how to organize agent knowledge and tool access in this repository.

## 1) Folder Structure

Use this structure to separate intent, workflow, and runtime tool access:

```text
.github/
  copilot-instructions.md
  instructions/
    habitus-api.instructions.md
    habitus-web.instructions.md
  prompts/
    review-backend-endpoint.prompt.md
    diagnose-postgres.prompt.md
  skills/
    habitus-context/
      SKILL.md
    postgres-ops/
      SKILL.md

.vscode/
  mcp.json
```

## 2) Why Split MCP Servers

Yes, it is possible and recommended to split MCP by concern:

- `mcp-habitus-postgres` MCP server:
  - Focus: schema, read-only data inspection, migration diagnostics.
  - Benefit: controlled DB access and simpler permission boundaries.
- `mcp-habitus-api` MCP server:
  - Focus: OpenAPI exploration, endpoint checks, contract validation.
  - Benefit: app-level context without direct DB credentials.

This split reduces blast radius and keeps tools principle-of-least-privilege.

## 3) Suggested MCP Contracts

For `mcp-habitus-postgres` MCP:

- Tools: `list_tables`, `describe_table`, `run_query_readonly`, `check_migrations`.
- Policy: read-only by default.

For `mcp-habitus-api` MCP:

- Tools: `list_endpoints`, `call_endpoint_dev`, `inspect_openapi`, `validate_auth_scope`.
- Policy: non-destructive operations in development environment.

## 4) Operational Notes

- Keep secrets in environment variables, never in tracked files.
- Use dedicated development credentials for MCP servers.
- Log MCP calls for audit/debug in local development.

## 5) Next Step

Implement or wire actual MCP servers and update `.vscode/mcp.json` commands/args to match your local binaries.

For the local `mcp-habitus-api` created in this repository:

```bash
cd tools/mcp-habitus-api
npm install
```

Then keep the API running on `http://localhost:8080` so MCP tools can inspect and call endpoints.

For the local `mcp-habitus-postgres` created in this repository:

```bash
cd tools/mcp-habitus-postgres
npm install
```

Then keep PostgreSQL available on the configured host/port (`localhost:5432` by default).