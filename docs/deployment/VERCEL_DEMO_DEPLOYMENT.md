# Vercel demo deployment

Status: deployed and production-smoke verified on 2026-07-25
Scope: protected DB-first demo-MVP from `FEM_MVP_ACCELERATED_PLAN.md` 3.0

## Resulting architecture

```text
Browser
  -> Vercel project: FEM demo-web
       -> same-origin /api/v1 external rewrite
            -> Vercel project: FEM NestJS API
                 -> pooled restricted connection
                      -> dedicated Neon PostgreSQL demo database
```

Vercel does not run the local Docker Compose database. For an external demo,
PostgreSQL must be a managed service. Use a dedicated Neon project/database
created through the Vercel Marketplace. Do not connect the development or any
future production database.

Two Vercel Projects are created from the same Git repository:

| Project        | Root Directory  | Purpose                             |
| -------------- | --------------- | ----------------------------------- |
| `fem-demo-api` | `.`             | NestJS API as one Vercel Function   |
| `fem-demo-web` | `apps/demo-web` | Vite SPA plus same-origin API proxy |

The frontend proxy keeps the browser on one origin. The API session therefore
retains `HttpOnly`, `Secure`, `SameSite=Strict` and the `/api/v1` cookie path.
Do not replace this with a browser-to-backend cross-origin URL.

Production aliases:

- frontend: `https://fem-demo-web.vercel.app`;
- backend health: `https://fem-demo-api.vercel.app/api/health`.

## 1. Prerequisites

- Repository pushed to GitHub.
- Vercel account with access to that repository.
- Vercel Node.js version set to **22.x** for both projects.
- Local Node.js 22 and pnpm 11.
- A password manager and authenticator application.
- The local ignored `.env.vercel.local` secret bundle created for this demo.

Never commit `.env.vercel.local`, database URLs, passwords, TOTP secrets or
recovery codes.

Load the local secret bundle into the current PowerShell process without
printing values:

```powershell
Get-Content .env.vercel.local | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2], 'Process')
  }
}
```

After creating Neon, fill `ADMIN_DATABASE_URL` in that ignored file with the
unpooled owner URL and rerun this import.

## 2. Create the API project and database

1. Import `https://github.com/EsinencuP/FEM` in Vercel.
2. Name the project `fem-demo-api`.
3. Keep Root Directory at the repository root (`.`).
4. Set Node.js to `22.x`.
5. Do not deploy with a development database URL.
6. In Vercel Marketplace install **Neon** and create a new, dedicated database
   project for this demo. Prefer a database name such as `fem_showcase`.
7. Enable both pooled and unpooled connection variables in the Neon
   integration. The unpooled owner credential is used only for migrations and
   provisioning. The running API uses a separate pooled restricted role.

The legacy Vercel Postgres product is no longer created for new projects.
Neon is a managed PostgreSQL integration; it is not the Supabase SDK and the
application continues to use Prisma and standard PostgreSQL.

## 3. Apply migrations to the empty demo database

Use the unpooled owner connection from Neon in a local PowerShell session.
Do not put it on the command line or in shell history.

```powershell
$env:DATABASE_URL = $env:ADMIN_DATABASE_URL
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

The migrations create the schema and the database-scoped
`fem_runtime_<database-hash>` capability. They must run before seed,
administrator bootstrap or runtime-role provisioning.

## 4. Seed the dedicated remote demo database

Remote demo seed remains fail-closed. It needs TLS, a non-production-like
database name, two explicit opt-ins and a confirmation bound to the exact host,
port and database name.

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = $env:ADMIN_DATABASE_URL
$env:ALLOW_DEMO_SEED = 'true'
$env:ALLOW_REMOTE_DEMO_SEED = 'true'
$env:REMOTE_DEMO_DATABASE_CONFIRMATION = pnpm --silent demo:database-confirmation
pnpm prisma:seed
pnpm prisma:seed
```

Both runs must report the same stable counts. Clear the seed-only variables
afterwards:

```powershell
Remove-Item Env:ALLOW_DEMO_SEED
Remove-Item Env:ALLOW_REMOTE_DEMO_SEED
Remove-Item Env:REMOTE_DEMO_DATABASE_CONFIRMATION
```

The remote seed uses a bounded 120-second interactive transaction timeout.
This is intentionally longer than the local default because TLS and managed
database round trips can exceed Prisma's five-second interactive transaction
default. It does not weaken the seed's database-name and confirmation gates.

## 5. Bootstrap the permanent demo administrator once

Load the fixed values from the ignored `.env.vercel.local` into the current
shell without printing them. Keep `DATABASE_URL` on the owner connection for
this privileged operation.

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = $env:ADMIN_DATABASE_URL
$env:ALLOW_ADMIN_BOOTSTRAP = 'true'
pnpm admin:bootstrap
Remove-Item Env:ALLOW_ADMIN_BOOTSTRAP
```

The script refuses to overwrite an existing credential. Save the one-time
recovery codes in the password manager. The email, password and Base32 TOTP
secret remain stable; the six-digit authenticator code changes normally every
30 seconds.

`AUTH_ENCRYPTION_KEY` is part of the account's cryptographic state. It must be
the same during bootstrap and every API deployment for this database. Losing or
changing it makes the stored TOTP secret unreadable.

The remote bootstrap transaction also uses a bounded 120-second timeout. The
script remains one-shot and refuses to replace an existing administrator.

## 6. Provision the restricted runtime database role

Use the owner credential and values from `.env.vercel.local`:

```powershell
$env:ALLOW_RUNTIME_ROLE_PROVISION = 'true'
pnpm demo:provision-runtime-role
Remove-Item Env:ALLOW_RUNTIME_ROLE_PROVISION
```

The command:

- requires the migration-created NOLOGIN capability;
- creates or safely updates only the named restricted LOGIN;
- refuses unsafe role attributes or unrelated memberships;
- grants membership without admin or SET capability;
- fails if that login can connect to another database.

If the final adjacent-database check fails, stop. In a dedicated Neon project,
review the listed databases and revoke their default `PUBLIC CONNECT` only
after confirming no other workload uses them. Do not run a broad revoke on a
shared PostgreSQL cluster. Rerun the command until the preflight passes.

Neon-managed PostgreSQL has three provider-owned behaviors that the runtime
preflight recognizes narrowly:

- the database owner receives an automatic non-inheriting administrative
  membership in newly created roles;
- provider system databases `postgres`, `template0` and `template1` retain
  managed connectivity;
- `pg_trgm` extension functions retain provider-managed `PUBLIC EXECUTE`.

The exceptions apply only when the Neon marker role is present, and the
function exception applies only to functions registered as members of the
`pg_trgm` extension. User-created adjacent databases, custom functions,
unexpected grants and unsafe role attributes still fail the production gate.

In Neon, open **Connect**, select `fem_demo_runtime`, choose the pooled
connection and copy its URL. That pooled URL becomes the API project's
`DATABASE_URL`. Never use the owner URL in the running Vercel Function.

## 7. Configure API production variables

Add the following to the `fem-demo-api` **Production** environment. Mark
database and authentication values as sensitive.

```text
NODE_ENV=production
PORT=3000
API_PREFIX=api
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=https://<fem-demo-web-production-domain>
AUTH_ENCRYPTION_KEY=<stable value from .env.vercel.local>
AUTH_COOKIE_NAME=fem_admin_session
AUTH_SESSION_TTL_MINUTES=480
AUTH_SESSION_IDLE_MINUTES=30
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_MINUTES=15
HSTS_ENABLED=true
TRUST_PROXY_HOPS=0
RATE_LIMIT_DEFAULT_PER_MINUTE=120
RATE_LIMIT_AUTH_PER_MINUTE=5
RATE_LIMIT_ADMIN_PER_MINUTE=300
RATE_LIMIT_PUBLIC_PER_MINUTE=600
RATE_LIMIT_SEARCH_PER_MINUTE=120
RATE_LIMIT_FILES_PER_MINUTE=60
RATE_LIMIT_INTEGRATIONS_PER_MINUTE=300
SWAGGER_ENABLED=false
ALLOW_ADMIN_BOOTSTRAP=false
DATABASE_URL=<pooled URL for fem_demo_runtime>
```

Do not add `ADMIN_DATABASE_URL`, `INITIAL_ADMIN_*`,
`RUNTIME_DATABASE_PASSWORD`, seed flags or provisioning flags to the running
API project.

Deploy the API and verify:

```text
https://<api-domain>/api/health
```

The response must report `status=ok` and `database=connected`. A production
startup failure mentioning the restricted role is a security gate, not a
reason to switch back to the owner credential.

## 8. Create and configure the frontend project

1. Import the same repository again as a second Vercel Project.
2. Name it `fem-demo-web`.
3. Set Root Directory to `apps/demo-web`.
4. Set Node.js to `22.x`.
5. Keep `VITE_API_BASE_URL` unset in production. The compiled frontend defaults
   to relative `/api/v1` requests.

`apps/demo-web/vercel.json` contains a fixed, narrow rewrite from
`/api/v1/:path*` to the stable `https://fem-demo-api.vercel.app/api/v1/:path*`
alias. The SPA fallback explicitly excludes `/api/`, so API requests cannot be
accidentally served `index.html`. The browser remains on the frontend origin,
and Vercel forwards the request and response cookies.

Deploy the frontend. After its final stable domain is known, update
`CORS_ALLOWED_ORIGINS` in the API project to that exact HTTPS origin and
redeploy the API.

## 9. Customer-demo acceptance smoke

Use a new private browser session:

1. Open `https://<fem-demo-web-production-domain>/login`.
2. Sign in with the fixed demo email and password.
3. Enter the current code from the authenticator entry created with the fixed
   Base32 secret.
4. Verify `/athletes`, one athlete card, `/horses`, one horse card,
   `/competitions`, one competition, class selection and results.
5. Perform one safe demo update and reload the page.
6. Log out and log in again.
7. Confirm the browser never calls the backend Vercel domain directly; requests
   should remain under the frontend `/api/v1`.
8. Verify direct `/api/docs` is unavailable because Swagger is disabled.

## 10. Preview and branch policy

The permanent customer link is the Production deployment only. Do not attach
the production demo database secrets to arbitrary Preview deployments.
Preview environments should remain without database/auth secrets or use
separate Neon branches and separate bootstrap identities.

## 11. Recovery and rotation

- A Vercel redeploy does not recreate the account; the credential is stored in
  PostgreSQL.
- Keep the fixed email/password/TOTP secret and recovery codes in a password
  manager.
- Never rerun administrator bootstrap during normal deploys.
- If the account is compromised, rotate password/TOTP using the protected API
  and replace the shared customer credentials.
- After the customer demonstration, decide whether to retain or delete the
  dedicated demo database. Do not convert it into a production database.
- Enable Neon backups/point-in-time recovery appropriate to the selected plan
  before relying on the demo for ongoing data entry.

## 12. Local fallback

The existing local path remains supported:

```powershell
pnpm db:up
pnpm start:dev
pnpm web:build
pnpm web:preview
```

Use `127.0.0.1` consistently for both local applications.

## 13. Verified deployment gate

Verified locally on 2026-07-25 with Node.js 22.23.1, pnpm 11.9.0,
PostgreSQL 16 and Vercel CLI 56.5.0:

- all 17 migrations applied to clean
  `fem_audit_vercel_deploy_20260725`;
- guarded seed ran twice with stable counters;
- Prisma validate and generate passed;
- backend lint, strict typecheck, 74 unit tests and build passed;
- database constraint suites passed: 28 tests;
- E2E passed: 12 suites, 85 tests;
- demo-web lint, strict typecheck, 18 tests and production build passed;
- same-origin Vercel proxy tests passed, including secure session-cookie
  forwarding and fail-closed behavior;
- Graphify refreshed to 2466 nodes, 5153 edges and 179 communities;
- prepared secret values are absent from tracked files.

External deployment completed on 2026-07-25:

- Neon project `fem-showcase`, database `fem_showcase`;
- all 17 migrations applied;
- seed executed twice with stable counts: 5 countries, 1 federation,
  3 disciplines, 4 clubs, 16 athletes, 16 horses, 5 owners, 3 events,
  12 classes, 60 results and 1 ranking snapshot;
- restricted runtime role provisioned and production startup preflight passed;
- backend Vercel project `fem-demo-api`, Node.js 22.x, production alias ready;
- frontend Vercel project `fem-demo-web`, Node.js 22.x, production alias ready;
- HTTPS smoke: health `200` with `database=connected`, Public API `200`,
  unauthenticated Admin API `401`, Swagger `404`;
- fixed password plus TOTP login succeeded through the frontend same-origin
  route;
- authenticated athlete and horse lists each returned 16 records;
- competitions returned 3 events, 12 classes and linked result rows;
- frontend CSP, HSTS and `X-Frame-Options: DENY` are present.

Final external demo status: **GO**.
