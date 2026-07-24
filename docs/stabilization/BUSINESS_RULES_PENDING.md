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
- long-term identity provider and additional human role/permission matrix;
- legal audit retention and actor-erasure policy.

## Stabilization policy

- unknown rules remain nullable/configurable or are rejected from automatic
  interpretation;
- no official identifier is generated;
- no ranking calculation is implemented;
- temporary behavior must be labelled `ASSUMPTION` and receive an explicit
  regression test before use.

## Active temporary assumptions

- **ASSUMPTION-PUBLICATION-01:** ordinary create/update requests cannot publish
  competitions or results. They remain `DRAFT`; publication uses dedicated
  protected, reasoned and audit-atomic `publish`/`withdraw` commands. Published
  result correction requires withdrawal first.
- **ASSUMPTION-PUBLIC-VISIBILITY-01:** non-demo, non-archived `ACTIVE` and
  `INACTIVE` sports profiles/references may be public; `DRAFT` and `ARCHIVED`
  are hidden. This preserves historical results pending a Federation decision.
- **ASSUMPTION-LOCALE-01:** Public routes require lowercase `ro` or `ru`.
  Sports source fields are language-neutral until the translation model and
  fallback policy are approved; no machine translation is performed.
- **ASSUMPTION-ARCHIVE-01:** an archived primary entity must be restored before
  ordinary PATCH or before receiving new child relations.
- **ASSUMPTION-DEMO-01:** connected records and source evidence must share one
  demo boundary. API writes derive that boundary from active references and
  reject mixed graphs.
- **ASSUMPTION-VERIFICATION-01:** once an external identifier is marked other
  than `UNVERIFIED`, generic PATCH cannot change it. Correction requires a
  future audited replacement workflow.

Each assumption is a safety constraint, not an official Federation rule.
