-- Operator only, after explicit production approval. Disable the report without
-- changing saved activity or restoring the unused anonymous analytics writer.
begin;
set local lock_timeout = '5s';
drop function if exists commito_private.free_engagement_report(timestamptz,uuid[]);
commit;
