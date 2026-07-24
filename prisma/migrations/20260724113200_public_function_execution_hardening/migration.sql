-- pg_trgm installs helper functions with PUBLIC EXECUTE by default. Runtime
-- queries use the operator classes through indexes and do not need permission
-- to call any function in the application schema directly.
REVOKE ALL
ON ALL FUNCTIONS IN SCHEMA public
FROM PUBLIC;
