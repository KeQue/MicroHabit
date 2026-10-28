-- Trusted database operator ONLY. No app credentials or exported personal rows.
-- Default report: retained free data, 12 UTC months and 12 UTC Monday weeks.
-- Supply reviewed test/reviewer league UUID exclusions in the empty array if
-- needed. Excluded IDs do not appear in the report. Do not guess identifiers.
-- p_as_of controls period/maturity cutoffs, not restoration of historical state:
-- later edits, undo and account/owner deletion change retained-data totals.
begin read only;
set local statement_timeout='30s';
set local timezone='UTC';
select jsonb_pretty(commito_private.free_engagement_report(
  p_as_of => clock_timestamp(),
  p_excluded_leagues => array[]::uuid[]
)) as free_engagement;
commit;
