# Commito Launch Security and Accessibility Audit

Date: 2026-06-03

## Scope

Baseline launch review for:

- Sensitive data and credential leaks.
- Supabase RLS and public RPC exposure.
- Production logging of user identifiers or raw backend errors.
- Core mobile accessibility for auth, plan selection, joining, league use, and account actions.

Reference standards to use for follow-up reviews:

- OWASP MASVS for mobile app security.
- OWASP ASVS for backend/API authorization checks.
- WCAG 2.2 for accessibility expectations.

## Fixed In This Pass

- Removed raw debug logging from league member loading, daily log upserts, realtime subscription status, and auth profile creation failures.
- Added accessibility roles/labels to auth buttons and form inputs.
- Added accessibility labels to account actions, create/join league actions, plan cards, invite flow controls, paywall actions, league menu actions, view tabs, and day tiles.
- Increased day-tile hit targets with `hitSlop`.
- Added a Supabase hardening migration to:
  - remove broad legacy `daily_logs` self-write policies;
  - require membership/access state, joined date, and today/yesterday date window for daily log writes;
  - remove direct self-insert/delete policies from `league_members`;
  - revoke public access to paywall toggle and legacy daily-log toggle RPCs;
  - delete owned leagues during account deletion so user-linked `created_by` records are not retained.
- Added a second Supabase guardrail migration to keep paid leagues closed until
  server-side purchase verification exists:
  - paid league creation now raises `payment_required`;
  - paid invite acceptance now raises `payment_required`;
  - free invite joins remain idempotent;
  - daily log writes are limited to members of free leagues.
- Added `.env` to `.gitignore`.

## Still Required Before Launch

- Confirm the Supabase guardrail migrations are applied in the target production project before each release, then retest with real users.
- Untrack the committed `.env` file and use local/EAS secrets for environment values.
- Refresh `supabase/schema.sql` from the live database after migration so the dump matches production.
- Implement RevenueCat/server-side purchase verification before re-enabling paid league creation, paid invite acceptance, or paid-league daily logging.
- Test direct Supabase REST/RPC calls for blocked cases:
  - non-member cannot write `daily_logs`;
  - unpaid member cannot write paid-league `daily_logs`;
  - authenticated user cannot create a paid league through `create_league_and_join`;
  - authenticated user cannot accept a paid invite through `accept_invite_and_agree`;
  - joined member cannot write days before `joined_at`;
  - joined member cannot write dates outside today/yesterday;
  - user cannot insert themselves directly into `league_members`;
  - authenticated user cannot call `set_paywall_enabled`.
- Run manual VoiceOver testing on TestFlight:
  - sign in/sign up/reset password;
  - choose plan;
  - join by invite;
  - toggle today/yesterday;
  - switch My View/Ranking;
  - invite, menu, edit display name, sign out, delete account.
- Test larger text/dynamic type and high-contrast readability on the main league screen.
- Support email is set to commito.support@gmail.com.

