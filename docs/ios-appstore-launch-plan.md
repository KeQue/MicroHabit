# MicroHabit / Commito iOS App Store Launch Plan

Last updated: 2026-05-08

## Refined Product Direction

Working brand direction: Commito.

Homepage promise:

> Turn your habits into monthly commitments with friends.

Supporting line:

> Built-in accountability. Real consequences.

The product should orbit four pillars:

- Social: do it with friends.
- Monthly Reset: 30 days, clean slate.
- Consequences: show up, or pay.
- Real Stakes: money or charity.

Brand positioning options:

- Softer: Friendly Accountability Leagues.
- Stronger: Social Commitment Leagues.
- Premium: Structured Commitment Leagues.

Current strategic read: Commito is strongest when it feels like a social contract with consequences, not a generic habit tracker. The launch should preserve that identity.

## Marketing Message

Homepage headline:

> Turn your habits into monthly commitments with friends.

Subtext:

> Built-in accountability. Real consequences.

Core promise:

- Users do it with friends.
- Each league runs as a monthly commitment.
- The month resets cleanly after 30 days.
- Users show up, or there is a consequence.
- Stakes can be money, charity, or both.

Best short positioning:

- Friendly Accountability Leagues for a softer brand.
- Social Commitment Leagues for stronger positioning.
- Structured Commitment Leagues for a premium feel.

Recommended positioning for launch: Social Commitment Leagues.

## Launch Decision

Ship the first App Store version with paid league access, manual digital rewards, and manual charity donations.

Current code has a paywall screen, plan tiers, and paid-league gates, but the app says purchases are not implemented. Apple review can reject incomplete paid functionality or non-IAP unlocking. For launch, use this MVP structure:

- Users buy league access through Apple/Google in-app purchases.
- RevenueCat handles purchase/entitlement infrastructure.
- Supabase records payment state, league access, results, rewards, and charity ledger rows.
- Commito calculates winners.
- Winners receive manual digital gift cards.
- Commito makes monthly manual charity donations and uploads receipts.

Do not build wallets, cash payouts, pooled pots, Stripe Connect, bank withdrawals, or automated charity transfers for MVP.

## Monetization Direction

Refined plan tiers:

- EUR 5: Friendly League, light commitment.
- EUR 10: Competitive League, serious commitment.
- EUR 20: Elite League, serious/high-stakes commitment.

Recommended internal model:

- Friendly League, EUR 5 per person: EUR 2 Commito, EUR 3 charity, EUR 0 winner payout.
- Competitive League, EUR 10 per person: EUR 3 Commito, EUR 1 charity, EUR 6 winner reward pool.
- Elite League, EUR 20 per person: EUR 5 Commito, EUR 2 charity, EUR 13 winner reward pool.

Plan psychology:

- Friendly League: low-pressure accountability plus charity.
- Competitive League: mainstream paid plan with a reward worth caring about.
- Elite League: serious commitment with visibly higher stakes.

Example Competitive League reward pool before store/payment fees:

| Players | Total paid | Commito | Charity | Winner reward |
| ------: | ---------: | ------: | ------: | ------------: |
| 2 | EUR 20 | EUR 6 | EUR 2 | EUR 12 |
| 3 | EUR 30 | EUR 9 | EUR 3 | EUR 18 |
| 4 | EUR 40 | EUR 12 | EUR 4 | EUR 24 |
| 10 | EUR 100 | EUR 30 | EUR 10 | EUR 60 |
| 20 | EUR 200 | EUR 60 | EUR 20 | EUR 120 |

Example Elite League reward pool before store/payment fees:

| Players | Total paid | Commito | Charity | Winner reward |
| ------: | ---------: | ------: | ------: | ------------: |
| 2 | EUR 40 | EUR 10 | EUR 4 | EUR 26 |
| 3 | EUR 60 | EUR 15 | EUR 6 | EUR 39 |
| 4 | EUR 80 | EUR 20 | EUR 8 | EUR 52 |
| 10 | EUR 200 | EUR 50 | EUR 20 | EUR 130 |
| 20 | EUR 400 | EUR 100 | EUR 40 | EUR 260 |

Launch recommendation:

- Keep EUR 5, EUR 10, and EUR 20 in the pricing architecture.
- Make Competitive League the default/most popular plan.
- Let users choose intensity rather than making the price feel arbitrary.
- Use "Continue your league next month" as the renewal/conversion message.
- Do not expose exact internal split percentages in the UI.
- Use manual rewards and manual charity operations until volume proves automation is needed.

Suggested plan positioning:

- Friendly League: light commitment.
- Competitive League: serious commitment.
- Elite League: maximum commitment.

Best user-facing copy:

- Friendly League, EUR 5 per person: Commit together. Give together. All rewards go to charity.
- Competitive League, EUR 10 per person: Show up. Or pay up. Winner reward grows with league size. Small charity contribution included.
- Elite League, EUR 20 per person: Highest stakes. Biggest reward. For serious commitment leagues.

User-facing reward examples:

- Competitive, 3 players: winner about EUR 15-18.
- Competitive, 4 players: winner about EUR 20-24.
- Elite, 3 players: winner about EUR 35-39.
- Elite, 4 players: winner about EUR 48-52.

Product psychology:

- If Commito feels like "we put EUR 10 each and the loser pays," EUR 10 can convert.
- If Commito feels like a social contract with consequences, the paid plans make emotional sense.
- The UI and copy should make consequences feel real before asking users to pay.

Store fee warning:

- Apple/Google store fees come out before real net revenue.
- Do not promise exact EUR 3 / EUR 1 / EUR 6 splits in the UI unless the backend calculates from actual net revenue or Commito accepts reduced margin.
- Safer copy: "winner reward grows with league size," "a small amount supports charity," and "Commito keeps a platform fee."
- Keep the internal formula flexible until real payment, store fee, tax, refund, chargeback, and charity handling are proven.

Legal/App Store warning:

- Real-money winner payouts may be treated as contests, gaming, gambling, prize promotion, money transmission, or regulated payments depending on country.
- Apple requires contests/sweepstakes to have official rules and to state that Apple is not a sponsor or involved.
- Apple also warns that gaming, gambling, and lotteries are heavily regulated and may require licensing, permissions, and geo-restrictions.
- Before launching winner payouts, get legal review and decide which countries the app can support.

Launch-safe interpretation:

- Simplest App Store v1: users buy league access through Apple/Google billing, Commito calculates winners, winners receive digital gift cards manually or semi-automatically, and charity donations are made manually each month with receipts shown in-app.
- Do not build wallets, cash withdrawals, pooled-money custody, Stripe Connect, bank transfers, or user-to-user payouts for MVP.
- Full product v2: automated rewards, richer charity handling, and any cash-like payout system only after legal/payment infrastructure is ready.

## Chosen MVP Architecture

Best choice for easiest implementation, easiest maintenance, and cheapest operations:

```text
Apple/Google In-App Purchases
-> RevenueCat confirms purchase
-> Supabase records payment and league access
-> League runs for 30 days
-> Supabase calculates winner
-> Admin sends gift card manually
-> Admin makes monthly charity donation manually
-> Receipt is uploaded and shown in-app
```

Why this is the best MVP:

- Lowest engineering complexity.
- No wallet system.
- No user bank accounts.
- No Stripe Connect.
- No KYC flow.
- No cash withdrawal support.
- No automated charity payout integration.
- Lower operational and legal complexity.
- Good fit for a founder-built App Store launch.

Tradeoff:

- The first version is semi-manual.
- That is acceptable because it validates whether users pay, finish leagues, and continue next month before automating money operations.

Cost assumptions:

- Apple: eligible developers can qualify for the App Store Small Business Program, which reduces commission to 15% on paid apps and In-App Purchases.
- Google: most fee-paying developers are eligible for 15% or less through Google Play service-fee programs.
- RevenueCat: often free at small scale, then paid as revenue grows.
- Gift cards: manual gift cards can start with no integration cost; API providers can add fees later.
- Charity donations: manual monthly donation has no custom technical integration cost.

Do later, not at launch:

- Stripe Connect.
- Wallet balances.
- Bank payouts.
- Cash withdrawals.
- Automated gift card provider API.
- Automated charity APIs.
- Multiple user-selected charities.

Admin MVP:

- Simple admin screen or table is enough.
- Track league, winner, reward amount, charity amount, reward status, and receipt uploaded yes/no.

## Simple Payment And Reward MVP

Recommended launch stack:

- Expo / React Native.
- RevenueCat.
- Supabase.
- Apple In-App Purchase / StoreKit.
- Google Play Billing.

Payment products:

```text
commito_friendly_league_5
commito_competitive_league_10
commito_elite_league_20
```

Paid league cycle:

1. User chooses plan.
2. Apple/Google payment sheet opens.
3. Payment succeeds.
4. Backend verifies the purchase/entitlement through RevenueCat.
5. User is added to the paid league cycle.
6. League starts or continues.

Winner reward MVP:

- Use digital gift cards instead of cash payouts.
- Start manually: admin reviews result, sends gift card to winner email, marks reward as issued.
- Later automate through a provider such as Tremendous or Tango Card.
- Avoid user bank accounts, wallets, Stripe Connect, KYC, and cash withdrawals in v1.

Winner reward flow:

```text
League ends
-> Commito calculates winner
-> Admin reviews result
-> Gift card sent to winner email
-> Reward marked as issued
```

Charity MVP:

- Start with one approved charity.
- Track charity amount per league.
- Sum monthly charity balance.
- Donate manually once per month.
- Upload receipt or screenshot.
- Show receipt in-app.
- Only claim "donated" after the donation is actually made.

Charity flow:

```text
Track charity amount per league
-> Sum total monthly charity balance
-> Donate manually to one approved charity
-> Upload receipt
-> Show receipt in-app
```

Important wording:

- Avoid: bet, wager, gambling, cash prize, payout, win money.
- Prefer: commitment league, habit challenge, skill-based challenge, winner reward, digital reward, charity contribution.

User-facing pricing copy:

- Friendly League, EUR 5 per person: Commit together. Give together. All rewards go to charity.
- Competitive League, EUR 10 per person: Winner reward grows with league size. Small charity contribution included.
- Elite League, EUR 20 per person: Highest stakes. Biggest reward. For serious commitment leagues.

Store fee implementation:

- Calculate economics from net revenue, not gross price.
- Do not promise exact internal splits in the UI.
- Show estimated rewards, not guaranteed legal-style payout percentages.

Example Competitive League after an estimated 15% store fee:

```text
User pays: EUR 10
Estimated store fee: EUR 1.50
Estimated net: EUR 8.50

Commito: about EUR 2.50
Charity: about EUR 1.00
Winner reward pool: about EUR 5.00
```

For 3 players:

```text
Estimated net received: EUR 25.50
Winner gift card: about EUR 15
Charity: about EUR 3
Commito: about EUR 7.50
```

Implementation tables needed:

```text
payments
league_results
rewards
charity_ledger
```

Existing tables already cover:

```text
users/profiles
leagues
league_members
daily_logs/activity_logs
```

payments:

```text
id
user_id
league_id
plan_type
amount_gross
store_fee_estimate
amount_net
store
purchase_id
verified
created_at
```

rewards:

```text
id
league_id
winner_user_id
reward_amount
reward_type
status
issued_at
provider
provider_reward_id
```

charity_ledger:

```text
id
league_id
amount
charity_name
status
receipt_url
donated_at
```

First-month-free idea:

- Good if the app shows simulated consequences at month end.
- Dangerous if it simply delays payment without teaching the user why money matters.

Month-end conversion screen should show:

- You had X active days.
- You would have lost EUR 10.
- You would have won EUR 28.
- You would have donated EUR 10.

The goal is to let users feel the stakes before charging them.

## Naming Decision

The app currently ships as MicroHabit in config and UI. The product direction now points toward Commito.

Before App Store submission, choose one:

- Keep MicroHabit for v1 and use Commito language later.
- Rename to Commito before launch and align app name, icon, screenshots, metadata, and in-app copy.

Recommended: if commitment with money is the true product, rename before launch. Commito fits the concept better than MicroHabit.


## Objective 1: Confirm Release Configuration

Goal: the binary can be built, uploaded, and mapped to the existing App Store Connect app.

- Confirm `app.config.ts` is the source of truth for Expo config.
- Verify iOS bundle id: `com.sadik.microhabit`.
- Verify App Store Connect app id in `eas.json`: `6759626676`.
- Increment `ios.buildNumber` before every upload. Current value: `19`.
- Keep user-facing version aligned. Current app version: `1.0.2` in `app.config.ts`.
- Resolve config mismatch: `app.config.ts` has `supportsTablet: false`; `app.json` has `supportsTablet: true`. Expo should use dynamic config, but this should still be cleaned up to avoid confusion.
- Verify production build command:

```bash
npx eas build --platform ios --profile production
```

- Verify submission command:

```bash
npx eas submit --platform ios --profile production
```

## Objective 2: Remove Launch Blockers

Goal: avoid obvious App Review rejection reasons.

- Add an in-app account deletion entry point because the app supports account creation. Done in `account-deletion-app-review`.
- Add public Privacy Policy URL and Support URL for App Store Connect. Drafts added in `docs/privacy-policy.md` and `docs/support.md`; static pages added in `docs/privacy/index.html` and `docs/support/index.html`; GitHub Pages is enabled and the pages are live.
- Replace `support@commito.app` with a real support email before submission. Preferred future address: `commito.support@gmail.com`, but it still needs to be created and verified.
- Decide what to do with paid tiers before submission:
  - Free launch: remove or hide paid plan calls to action, paywall copy, and testing-only plan acceptance. Current code treats paid leagues as coming soon with `PAID_LEAGUES_AVAILABLE = false`.
  - Paid launch: implement Apple IAP, purchase restore, entitlement checks, and App Store Connect products.
- Create a reviewer demo account and include credentials in App Review notes.
- Ensure Supabase production project, auth providers, email confirmation, redirect URLs, and custom SMTP are production-ready.
- Ensure Google and Apple sign-in work in the production iOS build, not only Expo dev.
- Remove starter assets and unused Expo placeholder imagery if visible anywhere in the shipped app.

## Objective 3: Product QA Checklist

Goal: prove the core loop works on a real iPhone through TestFlight.

- Fresh install opens to auth without crashing.
- Email sign-up, email confirmation, sign-in, forgot password, and password update work.
- Google sign-in works.
- Apple sign-in works on iOS.
- Sign out returns to sign-in.
- Create a free league.
- Join a league by invite code.
- Invite code copy and native share work.
- Toggle today and yesterday habit days.
- Earlier and future days are blocked as expected.
- Ranking and My View update correctly.
- Pull-to-refresh works.
- Realtime updates appear across two accounts/devices.
- Display name edit saves and handles duplicate names gracefully.
- Local notification permission prompt appears at the right moment and daily reminder scheduling works.
- Denying notification permission does not break the app.
- Offline/poor network errors are understandable and recoverable.

## Objective 4: Privacy And Data Checklist

Goal: App Store privacy answers match the app.

Likely collected data for App Store privacy labels:

- Contact Info: email address, linked to user, used for app functionality/auth.
- User ID: Supabase auth user id, linked to user, used for app functionality.
- User Content: league names, activity names, daily logs, invite-related content, linked to user, used for app functionality.
- Identifiers or diagnostics may apply if Supabase/Expo services retain request metadata, crash logs, or device data. Confirm before filling the label.

Decisions to document in the privacy policy:

- What account data is stored.
- What league and habit data is stored.
- How invite codes expose league participation to invited users.
- Whether notification tokens are collected or only local notifications are used.
- How users can delete their account and data.
- Contact email for privacy/support requests.

## Objective 5: App Store Listing

Goal: finish everything Apple needs before review.

- App name: MicroHabit.
- Subtitle: keep under 30 characters.
- Category: likely Health & Fitness or Productivity. Pick based on positioning.
- Age rating: answer honestly based on user-generated league/activity names.
- Keywords: prepare a concise keyword list around habits, accountability, streaks, routines, groups.
- Description: explain the core loop without promising paid features not in v1.
- Screenshots: show actual in-app screens, not only splash/login.
- App preview video: optional for v1.
- Privacy Policy URL: required.
- Support URL: required in App Store Connect metadata.
- Review notes: include demo account, free MVP/purchase decision, and any auth flow notes.

## Objective 6: TestFlight Release

Goal: find review-blocking issues before Apple does.

- Build and submit production iOS binary.
- Wait for App Store Connect processing.
- Add internal testers first.
- Run a 2-account test: owner creates league, second user joins, both toggle days.
- Run a fresh-install auth test.
- Run a notification permission test.
- Run a password reset test from email link.
- Fix blockers, increment build number, rebuild.
- Add external testers only after internal smoke test passes.

## Objective 7: Submit For Review

Goal: submit a complete, honest v1.

- Select the final processed build in App Store Connect.
- Complete export compliance. Current config sets `ITSAppUsesNonExemptEncryption: false`.
- Complete privacy nutrition labels.
- Attach screenshots.
- Add review notes and demo account.
- Submit to App Review.
- Monitor review messages and respond quickly.

## Launch Scope Ladder

These are the smaller objectives that lead directly to the larger scope: launching MicroHabit/Commito on the App Store. Treat each objective as done only when its finish line is true.

### 1. Lock The Version 1 Scope

Goal: make v1 small enough to submit confidently.

- Choose Free Launch or Paid Launch.
- Decide whether the launch brand is MicroHabit or Commito.
- Choose the launch model: paid commitment, simulated stakes, or free MVP.
- If paid commitment, add Apple In-App Purchase before TestFlight review.
- If simulated stakes, build the month-end "you would have lost/won/donated" conversion screen.
- Define the v1 core loop in one sentence: create account, create or join a monthly commitment league, track daily habits, compare progress, and see consequences.
- Move everything outside that loop to post-launch.

Finish line: anyone opening the app can understand what v1 does without seeing unfinished payment/testing behavior.

### 2. Make The App Review-Safe

Goal: remove the things Apple is most likely to reject before users even test the app.

- Add account deletion inside the app. Done.
- Add Privacy Policy URL. Live: `https://keque.github.io/MicroHabit/privacy/`.
- Add Support URL. Live: `https://keque.github.io/MicroHabit/support/`.
- Replace the temporary support email in policy/support pages with a real mailbox before App Store submission.
- Prepare demo reviewer account.
- Confirm Sign in with Apple works if other social login is available.
- Confirm any paid feature is either hidden or handled through Apple IAP. Free-launch code path now hides testing unlocks and marks paid leagues as coming soon.
- Remove visible Expo starter content and placeholder imagery.

Finish line: App Store Connect can be filled honestly, and the reviewer has a complete path through the app.

### 3. Stabilize Authentication

Goal: make account creation and recovery reliable in production.

- Test email sign-up with a real inbox.
- Test email confirmation deep link back into the app.
- Test sign-in after confirmation.
- Test forgot password email.
- Test update password deep link.
- Test Google sign-in on an iPhone production/TestFlight build.
- Test Apple sign-in on an iPhone production/TestFlight build.
- Test sign-out and re-open app.
- Confirm Supabase auth redirect URLs match the production app scheme.

Finish line: a new user can create, recover, and return to an account without developer help.

### 4. Stabilize The League Core Loop

Goal: make the main product experience work from beginning to end.

- Create a free league.
- Enter league name and activity.
- See the created league in the league list.
- Open the league detail screen.
- Copy invite code.
- Share invite code.
- Join the league from a second account.
- Confirm both accounts appear in the league.
- Edit display name.
- Confirm duplicate/invalid display names show useful errors.

Finish line: two real users can get into the same league and recognize each other.

### 5. Stabilize Habit Tracking

Goal: make the actual habit behavior trustworthy.

- Toggle today's habit day.
- Toggle yesterday's habit day.
- Confirm earlier days cannot be edited.
- Confirm future days cannot be edited.
- Confirm the UI updates immediately after toggling.
- Confirm refresh keeps the same state.
- Confirm another account sees updates through realtime or refresh.
- Confirm My View and Ranking show correct counts.

Finish line: users trust that their checked days are saved and ranked correctly.

### 6. Stabilize Notifications

Goal: reminders help without breaking the app.

- Confirm notification permission prompt appears only after sign-in.
- Confirm accepting permission schedules the daily reminder.
- Confirm denying permission does not block the app.
- Confirm sign-out cancels reminders.
- Confirm the dev-only test notification is not visible in production.

Finish line: notifications behave politely and do not create review or UX problems.

### 7. Prepare Privacy And Data Answers

Goal: make App Store privacy labels match reality.

- List every type of user data stored in Supabase.
- Identify whether each data type is linked to the user.
- Identify whether each data type is used for tracking. Expected answer should be no unless a tracking SDK is added.
- Document account deletion behavior. Drafted in `docs/privacy-policy.md`.
- Document how league invite codes work.
- Document local notification behavior.
- Publish the privacy policy.

Finish line: the App Store privacy questionnaire can be completed without guessing.

### 8. Prepare Store Listing Assets

Goal: make the App Store page ready before the final build.

- Choose category.
- Write subtitle.
- Write promotional text if needed.
- Write description focused only on shipped v1 behavior.
- Prepare keywords.
- Capture iPhone screenshots from the production/TestFlight build.
- Add privacy policy URL.
- Add support URL.
- Add reviewer notes.

Finish line: App Store Connect metadata is complete except for selecting the final build.

### 9. Build The First Release Candidate

Goal: get a real binary into TestFlight.

- Run TypeScript check.
- Run lint.
- Increment iOS build number from `19` to `20`.
- Create production EAS build.
- Submit build to App Store Connect.
- Wait for processing.
- Add internal testers.

Finish line: build 20 is installable from TestFlight.

### 10. Run TestFlight Smoke Tests

Goal: find critical issues before App Review.

- Fresh install test.
- Auth test.
- Two-account league test.
- Habit toggle test.
- Invite code test.
- Notification permission test.
- Password reset test.
- Poor network test.
- App restart test.

Finish line: no critical crash, auth, data-loss, or review-blocking bugs remain.

### 11. Fix And Rebuild

Goal: turn TestFlight findings into the final submission build.

- Fix only launch blockers.
- Avoid adding new features during this phase.
- Increment build number again if a new upload is needed.
- Re-run the smoke test after each release-candidate build.

Finish line: final release candidate is stable enough to give to Apple.

### 12. Submit For App Review

Goal: send a complete v1 to Apple.

- Select final build in App Store Connect.
- Complete export compliance.
- Complete App Privacy details.
- Attach screenshots.
- Add demo account credentials.
- Add reviewer notes explaining any auth/payment decisions.
- Submit for review.

Finish line: app status is waiting for review or in review.

### 13. Prepare Launch Day

Goal: be ready when the app is approved.

- Decide manual release or automatic release.
- Prepare a short announcement.
- Prepare support response for login, invite code, and notification issues.
- Monitor Supabase logs after release.
- Monitor App Store review feedback.
- Write down the first v1.1 improvements, but do not block launch on them.

Finish line: the app is live and you have a simple support plan.

## Useful References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion requirement: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple app privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Expo iOS production builds: https://docs.expo.dev/tutorial/eas/ios-production-build/
- Expo iOS submit docs: https://docs.expo.dev/submit/ios/
