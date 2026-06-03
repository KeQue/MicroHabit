# App Review Notes

Use this as the App Review notes text in App Store Connect after the final
TestFlight build is selected. Do not commit real passwords to this repository.

## Reviewer Demo Account

Create this account in the production Supabase project before submission:

```text
Email: [REVIEWER_DEMO_EMAIL]
Password: [REVIEWER_DEMO_PASSWORD]
```

Recommended account:

```text
Email: appreview@microhabit.app
Password: create a strong temporary password and store it outside git
```

If `appreview@microhabit.app` is not available, use a real mailbox you control.
The account must be confirmed and able to sign in before you submit the app.

## App Review Notes Template

```text
Thank you for reviewing Commito.

Commito is a free MVP for creating or joining monthly accountability leagues
with friends. Users can create an account, create a free league, share an invite
code, join a league, track today/yesterday habit completion, and compare progress
in My View and Ranking.

Demo account:
Email: [REVIEWER_DEMO_EMAIL]
Password: [REVIEWER_DEMO_PASSWORD]

Suggested review flow:
1. Sign in with the demo account above.
2. Create a free league from the Leagues screen.
3. Open the league and copy or share the invite code.
4. Toggle today or yesterday in the habit grid.
5. Open Ranking to see progress.
6. Open Account to verify Sign out and Delete account are available.

Paid commitment leagues are not enabled in this App Store version. Any paid tiers
are hidden or blocked until Apple in-app purchases are implemented. There are no
wallets, cash payouts, pooled money, or user-to-user payments in this version.

Privacy Policy:
https://keque.github.io/MicroHabit/privacy/

Support:
https://keque.github.io/MicroHabit/support/

Note: before submission, replace the temporary support email shown on those pages
with a real mailbox controlled by the developer.
```

## Demo Account Creation Checklist

- Create the reviewer account in production Supabase Auth.
- Confirm the email address, or disable confirmation only if that is the final
  production auth decision.
- Sign in on the final TestFlight build with the demo credentials.
- Create one sample free league named `App Review League`.
- Add activity `Daily walk`.
- Toggle today once so the reviewer sees a non-empty state.
- Confirm account deletion is visible but do not delete the reviewer account.
- Store the demo password in a private password manager, not in git.

## Final Review Notes Checklist

- Replace `[REVIEWER_DEMO_EMAIL]`.
- Replace `[REVIEWER_DEMO_PASSWORD]`.
- Replace the support email in the privacy/support pages before submission.
- Confirm the Privacy Policy URL works.
- Confirm the Support URL works.
- Confirm the selected build is the same build used for the demo-account test.
