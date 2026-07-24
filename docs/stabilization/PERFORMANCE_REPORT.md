# Performance Report

Status: **LOCAL MVP BASELINE PASS**

## Reproducible fixture

`RUN_PERFORMANCE_AUDIT=true pnpm test:performance` is guarded to a local
test/audit database. It creates and removes 1,000 athletes, 1,000 horses,
100 clubs, 100 competitions, 1,000 classes, 10,000 results, 1,000 historical
memberships and 1,000 identifiers. The residue check is zero.

## Three final measurements

Environment: PostgreSQL 16.14 Docker, Node 22.23.1, Prisma 6.19.3, Windows 11.
These are local functional measurements, not a production SLA.

| Gate | 100-result list | 10k count | athlete search |  payload |
| ---- | --------------: | --------: | -------------: | -------: |
| 1    |        38.21 ms |  13.89 ms |        5.04 ms | 37,675 B |
| 2    |        32.42 ms |  11.58 ms |        4.33 ms | 37,668 B |
| 3    |        29.29 ms |  12.86 ms |        4.90 ms | 37,675 B |

## Static controls

- primary lists are paginated and capped at 100;
- stable secondary `id` ordering is present;
- result lists contain at most 10 metric previews and detail at most the
  supported 100 metrics;
- query projections avoid an obvious per-row N+1 loop.

## Accepted limitations

- offset pagination permits very large page numbers;
- no `EXPLAIN (ANALYZE, BUFFERS)` evidence is captured;
- peak memory, multi-client throughput and production network latency are not
  measured;
- no SLA or payload budget has been approved.

Performance score: **7.0/10**.
