# Regression Matrix

| Area                  | Positive                 | Negative                                 | Boundary                | Adversarial                                      | Status                           |
| --------------------- | ------------------------ | ---------------------------------------- | ----------------------- | ------------------------------------------------ | -------------------------------- |
| Test DB guard         | local audit/CI accepted  | dev/remote/malformed rejected            | name/host patterns      | remote `ci_database` rejected                    | PASS                             |
| Demo seed             | seed x3                  | natural/deterministic non-demo collision | stable logical counts   | late rollback + concurrent retry                 | PASS                             |
| Boolean query         | literal true/false       | 0/1/yes/empty rejected                   | omitted value           | HTTP result-set comparison                       | PASS                             |
| Result outcome        | status/rank/metric       | empty result                             | 0 numeric accepted      | concurrent last-outcome race                     | PASS                             |
| Event/class dates     | inside period            | shrink excludes class                    | exact dates             | concurrent shrink/create                         | PASS                             |
| Archive relations     | active parents           | archived parent/result                   | repeat archive/restore  | restore under archived reference                 | PASS                             |
| Demo provenance       | all-demo/all-official    | mixed parents                            | optional references     | descendant reparent blocked                      | PASS                             |
| Identifier provenance | server UNVERIFIED        | privileged fields rejected               | NFKC/trim               | duplicate race + verified immutable              | PASS                             |
| Request body          | normal JSON              | malformed JSON                           | 100 KiB limit           | post-error health                                | PASS                             |
| OpenAPI               | 115 success contracts    | missing schema test                      | health/list/204         | Admin/Public security and relation contracts     | PASS                             |
| Concurrency           | serializable + versions  | stale/replay conflicts mapped            | retry limit             | races, idempotency, token reuse                  | PASS                             |
| Performance           | 10k result fixture       | residue check                            | bounded metric graph    | query/payload timing                             | PASS locally                     |
| Admin authentication  | TOTP/recovery session    | invalid/expired/revoked                  | idle/absolute expiry    | lockout and factor races                         | PASS targeted                    |
| Authorization         | persisted permissions    | role without permission                  | active role interval    | immediate permission removal                     | PASS targeted                    |
| Admin write safety    | CSRF/idempotency/version | missing/stale/conflicting headers        | controlled `*` override | duplicate POST + same-version PATCH              | PASS targeted                    |
| Application audit     | atomic append-only       | audit insert failure                     | nullable system actor   | update/delete/truncate rejected                  | PASS targeted                    |
| Public API            | 14 locale-scoped GETs    | draft/demo/archive/internal exposure     | page/filter/null sort   | ancestor closure, 404 oracle, ETag, rate contour | PASS targeted; full gate pending |
