# Business Rules Pending

No assumption in this file is an official Federation rule.

## Existing unresolved decisions

- official result-status vocabulary and relationship between status and rank;
- whether historical club, owner and athlete–horse intervals may overlap;
- whether only one current ownership/membership is allowed;
- publication authority and approval workflow;
- public-field allowlists for athletes, horses, owners and identifiers;
- official identifier namespaces and issuer-specific normalization;
- official ranking formula, eligibility, rounding and tie-break rules.
- identity provider, session/token model and mandatory 2FA population;
- role/permission matrix and protected administrative namespace;
- append-only audit actor, reason and retention policy;
- optimistic concurrency and idempotency-key client protocol.

## Stabilization policy

- unknown rules remain nullable/configurable or are rejected from automatic
  interpretation;
- no official identifier is generated;
- no ranking calculation is implemented;
- temporary behavior must be labelled `ASSUMPTION` and receive an explicit
  regression test before use.

## Active temporary assumptions

- **ASSUMPTION-PUBLICATION-01:** ordinary create/update requests cannot publish
  competitions or results. They remain `DRAFT`; publication requires a future
  authenticated, authorized and audited command.
- **ASSUMPTION-ARCHIVE-01:** an archived primary entity must be restored before
  ordinary PATCH or before receiving new child relations.
- **ASSUMPTION-DEMO-01:** connected records and source evidence must share one
  demo boundary. API writes derive that boundary from active references and
  reject mixed graphs.
- **ASSUMPTION-VERIFICATION-01:** once an external identifier is marked other
  than `UNVERIFIED`, generic PATCH cannot change it. Correction requires a
  future audited replacement workflow.

Each assumption is a safety constraint, not an official Federation rule.
