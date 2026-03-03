# Future TODO

- Add Postgres-backed integration tests for repositories and API routes, plus a minimal end-to-end flow for auth, chore lifecycle, and account deletion.
- Add rate limiting via shared infrastructure (for example Redis/Upstash) and/or edge protections at WAF level.
- Revisit strict DB schema constraints (check constraints/enums/date invariants) with a staged migration plan.
