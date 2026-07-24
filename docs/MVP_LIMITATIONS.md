# MVP Limitations

Current status: private development backend only.

- Authentication, login, JWT/session handling and 2FA are absent.
- Roles and permissions are absent.
- The API must not be exposed publicly without an access-control layer.
- Protected Admin and allowlisted Public API namespaces are absent.
- Current reads may include draft, archived or internal data when explicitly
  requested.
- Official ranking is not calculated.
- Competition registration, entries, payments, start lists and live scoring are
  absent.
- Excel import/export, FEI synchronization, webhooks and background jobs are
  absent.
- Atomic actor-attributed application audit is not implemented.
- Rate limiting and an approved CORS/security-header policy are not implemented.
- Frontend, administrative panel and public website are outside the current
  stabilization stage.

See `docs/stabilization/FINAL_STABILIZATION_REPORT.md` for verified controls and
the exact deployment blockers.
