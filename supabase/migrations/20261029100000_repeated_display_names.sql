-- Local reviewed change. Production execution requires explicit approval.
-- profiles.username is a presentation field in the existing app, not a login
-- identifier. Account identity and all memberships/check-ins use UUIDs.
-- Keep the primary key, existing name length check, RLS, grants and triggers.
drop index public.profiles_username_unique;
