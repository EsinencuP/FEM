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

## Stabilization policy

- unknown rules remain nullable/configurable or are rejected from automatic
  interpretation;
- no official identifier is generated;
- no ranking calculation is implemented;
- temporary behavior must be labelled `ASSUMPTION` and receive an explicit
  regression test before use.

