# FEM backend release TODO

Updated: 2026-07-24

- [x] Stage 1 — Frontend Integration Readiness
  - [x] approved-origin CORS configuration
  - [x] stable `/api/v1` contract and API surface inventory
  - [x] resource-specific OpenAPI success schemas
  - [x] detail/list relation projections and UUID path contracts
  - [x] deterministic OpenAPI snapshot/checksum CI gate
  - [x] nested identifier pagination runtime coverage
  - [x] frontend API matrix and contract tests
  - [x] independent review and stage gate — STRICT GO
- [ ] Stage 2 — Admin Protection
  - [ ] authentication and session lifecycle
  - [ ] password hashing, refresh/logout and 2FA
  - [ ] RBAC/permissions and protected Admin API
  - [ ] rate limiting, headers, CSRF decision and protected Swagger
  - [ ] atomic audit and security tests
  - [ ] independent review and stage gate
- [ ] Stage 3 — Public API
  - [ ] published-only, non-archived routes
  - [ ] public field allowlists and stable slugs
  - [ ] caching/SEO readiness and contract tests
  - [ ] independent review and stage gate
- [ ] Stage 4 — CMS
  - [ ] news, pages, navigation, translations and SEO
  - [ ] media/documents and safe access policy
  - [ ] draft/publish/archive/revision/preview
  - [ ] migrations, seed, API, tests and documentation
  - [ ] independent review and stage gate
- [ ] Stage 5 — Full integration verification
- [ ] Stage 6 — Security, performance, database, Swagger, documentation,
      production, deployment, integration and regression audits
- [ ] Create and evidence `docs/release/PUBLIC_RELEASE_REPORT.md`

## Explicitly excluded

- frontend implementation;
- competition registration, applications, payments, start lists and live
  scoring;
- invented official ranking formula or Federation rules.
