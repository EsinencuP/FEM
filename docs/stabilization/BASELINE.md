# Stabilization Baseline

Status: initial evidence captured, no fixes applied  
Date: 2026-07-23 23:44 Europe/Chisinau  
Git commit: `032447a`  
Worktree: dirty before stabilization; all pre-existing changes must be preserved

## Environment

| Component      | Actual value            |
| -------------- | ----------------------- |
| OS             | Windows 11, build 26100 |
| Shell          | Windows PowerShell      |
| Node.js        | 22.23.1                 |
| pnpm           | 11.9.0                  |
| PostgreSQL     | 16.14, Docker container |
| Prisma         | 6.19.3                  |
| NestJS         | 11.1.28                 |
| Docker         | 29.6.2                  |
| Docker Compose | 5.3.1                   |

## Database safety boundary

- Development URL was inspected without printing credentials.
- Host: local `localhost`; development database: `equestrian_federation`.
- Dedicated database created without dropping or resetting another database:
  `fem_audit_20260723_stabilization`.
- Audit commands replace only the database pathname of the verified local URL.
- `.env` is not tracked; `.env.example` is the only tracked env template.
- Production-like and remote URLs are forbidden for destructive audit operations.

## Initial inventory

- Nest controllers: 10.
- Runtime route decorators: 85.
- OpenAPI paths: 59.
- OpenAPI operations: 85.
- OpenAPI write operations: 53.
- Public API paths: 0.
- OpenAPI security scheme: absent.
- Bruno collection: absent.
- Defined test scenarios observed in executed suites:
  - unit: 14;
  - database integration: 16;
  - HTTP E2E: 11.

## Clean audit database setup

| Step                                      | Result                           |
| ----------------------------------------- | -------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                             |
| Prisma validate                           | PASS                             |
| Prisma generate                           | PASS                             |
| `prisma migrate deploy` on empty audit DB | PASS, 2 migrations               |
| seed run 1                                | PASS, `5/1/3/3/10/12/5/3/8/36/1` |
| seed run 2                                | PASS, identical summary          |
| seed run 3                                | PASS, identical summary          |

The identical summary is evidence of stable reported counts. It is not yet
proof that every table is unchanged or that the seed is atomic and safe around
pre-existing non-demo data.

## Initial quality run

| Check                       | Result                                                 |
| --------------------------- | ------------------------------------------------------ |
| ESLint                      | PASS                                                   |
| TypeScript strict typecheck | PASS                                                   |
| Unit tests                  | PASS: 5 suites, 14 tests                               |
| DB integration tests        | FAIL: 16 tests blocked by hard-coded DB-name allowlist |
| HTTP E2E                    | PASS: 1 suite, 11 tests                                |
| Build                       | PASS                                                   |
| Coverage command            | PASS                                                   |
| Statement coverage          | 19.53%                                                 |
| Branch coverage             | 2.66%                                                  |
| Function coverage           | 3.75%                                                  |
| Line coverage               | 20.95%                                                 |
| Live health                 | HTTP 200, request ID present                           |
| OpenAPI JSON                | HTTP 200                                               |

Most controllers and services report 0% unit coverage. Passing E2E currently
covers list envelopes and one validation error, not the write API.

## Initial runtime/security observations

- Response header exposes `X-Powered-By: Express`.
- The running OpenAPI document exposes 53 unauthenticated write operations.
- There are no `/public` routes and no separate Admin/Integration namespace.
- The API cannot be exposed publicly in this state.
- No conclusion from the previous audit is accepted without a new reproduction.
