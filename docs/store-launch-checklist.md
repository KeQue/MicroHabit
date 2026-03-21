# Microhabit Store Launch Checklist

## Must Do This Week

- [ ] Verify Supabase email confirmation is enabled
- [x] Implement forgot-password flow
- [x] Implement password reset completion flow via deep link
- [x] Implement in-app account deletion entry point and backend path
- [x] Add crash reporting
- [x] Add `app_open` analytics event
- [x] Add `sign_up_started` analytics event
- [x] Add `sign_up_completed` analytics event
- [x] Add `login_completed` analytics event
- [x] Add `league_created` analytics event
- [x] Add `league_joined` analytics event
- [x] Add `first_check_in` analytics event
- [x] Add `reminder_enabled` analytics event
- [x] Add `notification_permission_granted` analytics event
- [ ] Build first Android production artifact with EAS
- [ ] Run one real Android device pass across core flows
- [ ] Review [20260320_fix_security_advisor_findings.sql](/c:/Users/sadik/microhabit/supabase/migrations/20260320_fix_security_advisor_findings.sql)
- [ ] Apply [20260320_fix_security_advisor_findings.sql](/c:/Users/sadik/microhabit/supabase/migrations/20260320_fix_security_advisor_findings.sql)

## Must Do Before Submission

- [ ] Verify sign up end to end
- [ ] Verify email confirmation end to end
- [ ] Verify sign in end to end
- [ ] Verify password reset end to end
- [ ] Verify account deletion end to end
- [ ] Verify notifications on iOS and Android
- [ ] Verify realtime for league joins
- [ ] Verify realtime for check-ins
- [ ] Confirm `profiles` row always exists
- [ ] Confirm `handle_new_user` stays idempotent
- [ ] Confirm create/join fails gracefully on bad profile state
- [ ] Reduce RLS to the minimum correct set
- [ ] Confirm common query indexes are present
- [x] Draft privacy policy
- [x] Draft terms of service
- [ ] Set support email
- [x] Draft support page
- [ ] Publish support URL
- [ ] Publish account deletion explanation
- [ ] Complete Apple privacy answers
- [ ] Complete Google Play Data Safety form
- [ ] Finalize app icon
- [ ] Finalize splash assets
- [ ] Capture iPhone screenshots
- [ ] Capture Android screenshots
- [x] Draft App Store / Play copy
- [x] Draft app review notes
- [ ] Finalize App Store subtitle, keywords, and description
- [ ] Finalize Google Play short and full description
- [ ] Verify production env vars
- [ ] Bump iOS build number
- [x] Set Android `versionCode`
- [ ] Run final typecheck/tests
- [ ] Build iOS release
- [ ] Build Android release
- [ ] Test install both release artifacts
- [ ] Submit to stores

## Can Wait Until After Launch

- [ ] Social login expansion
- [ ] Advanced leaderboard/social mechanics
- [ ] Server-side push notifications
- [ ] Additional monetization experiments
- [ ] Large UI redesigns

## Repo-Specific Known Gaps

- [x] Auth screens currently lack forgot-password and account deletion flows
- [x] Deep-link recovery/reset handling is not yet wired
- [x] No crash-reporting SDK is installed
- [x] No analytics SDK or event layer is installed
- [ ] Android production build has not been validated on-device
- [ ] README is still placeholder Expo starter content
