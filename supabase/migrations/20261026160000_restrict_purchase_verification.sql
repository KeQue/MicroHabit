-- The legacy live purchase RPC accepts caller-supplied verification results and
-- can insert paid memberships. It must not be callable by app clients while
-- real server-side store verification is absent, even with the paid UI hidden.
-- Preserve the function and existing payment data for trusted backend work.
revoke all on function public.verify_league_purchase(uuid, text, text, text, text, integer, text, jsonb) from public;
revoke all on function public.verify_league_purchase(uuid, text, text, text, text, integer, text, jsonb) from anon;
revoke all on function public.verify_league_purchase(uuid, text, text, text, text, integer, text, jsonb) from authenticated;
grant execute on function public.verify_league_purchase(uuid, text, text, text, text, integer, text, jsonb) to service_role;
