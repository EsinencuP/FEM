-- The trigger is invoked by PostgreSQL as part of ResultMetric writes; the
-- application runtime role does not need direct EXECUTE permission.
REVOKE ALL
ON FUNCTION "enforce_result_metric_demo_boundary"()
FROM PUBLIC;
