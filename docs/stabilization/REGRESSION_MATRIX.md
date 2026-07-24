# Regression Matrix

| Area                  | Positive                | Negative                                 | Boundary               | Adversarial                         | Status                        |
| --------------------- | ----------------------- | ---------------------------------------- | ---------------------- | ----------------------------------- | ----------------------------- |
| Test DB guard         | local audit/CI accepted | dev/remote/malformed rejected            | name/host patterns     | remote `ci_database` rejected       | PASS                          |
| Demo seed             | seed x3                 | natural/deterministic non-demo collision | stable logical counts  | late rollback + concurrent retry    | PASS                          |
| Boolean query         | literal true/false      | 0/1/yes/empty rejected                   | omitted value          | HTTP result-set comparison          | PASS                          |
| Result outcome        | status/rank/metric      | empty result                             | 0 numeric accepted     | concurrent last-outcome race        | PASS                          |
| Event/class dates     | inside period           | shrink excludes class                    | exact dates            | concurrent shrink/create            | PASS                          |
| Archive relations     | active parents          | archived parent/result                   | repeat archive/restore | restore under archived reference    | PASS                          |
| Demo provenance       | all-demo/all-official   | mixed parents                            | optional references    | descendant reparent blocked         | PASS                          |
| Identifier provenance | server UNVERIFIED       | privileged fields rejected               | NFKC/trim              | duplicate race + verified immutable | PASS                          |
| Request body          | normal JSON             | malformed JSON                           | 100 KiB limit          | post-error health                   | PASS                          |
| OpenAPI               | 85 success contracts    | missing schema test                      | health/list/204        | nested list classification          | PASS with MEDIUM typing limit |
| Concurrency           | serializable invariants | conflicts mapped                         | retry limit            | 4 HTTP races + seed pair            | CONDITIONAL PASS              |
| Performance           | 10k result fixture      | residue check                            | bounded metric graph   | query/payload timing                | PASS locally                  |
| Public/Admin API      | —                       | unauthenticated writes                   | —                      | draft/internal exposure             | BLOCKED                       |
| Application audit     | table exists            | no atomic writer                         | nullable actor         | unauthenticated attribution         | BLOCKED                       |
