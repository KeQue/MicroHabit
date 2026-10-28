# Lessons for assistant work

Record observed gaps and concrete changes to the working method. This is not
a roadmap, confidence score, or claim that the model has been retrained.

## Distinguish an app address from a usable shared invitation

- Observation: the founder reported the build-33 app-only URI unclickable both
  in Commito's preview and after sharing. The preview was a plain Text element;
  a correct Expo URI did not establish that a messenger would make it tappable.
- Correction: share a published HTTPS invitation page, make its preview link
  explicitly interactive, and preserve manual code entry. Keep web sharing off
  until publication is verified. Do not claim universal/deferred linking or
  automatic installation handoff from a web bridge with an Open button.
- Executed transfer checks: web mode shares HTTPS; unpublished mode contains
  no dead link; the bridge rejects duplicate/unsafe input and matches the actual
  installed Expo native URL. Copy denial retains manual entry. Chrome checks at
  actual 320px/390px viewports show no horizontal overflow. Actual iPhone and
  messenger behavior remains pending publication and device testing.

## Bind invitation cancellation to the opened intent

- Observation: final Batch-2 review found that editing a prefilled code detached
  Back/success cleanup from the remembered invitation. A screen-handler test
  reproduced the stale intent before correction; build 32 had already uploaded.
- Correction: use the route's immutable invitation nonce for cleanup, with a
  conditional clear that cannot erase a newer invitation. Review this before
  starting native delivery rather than relying only on unchanged-input cases.
- Executed transfer checks: cancel after editing, successfully join after
  editing, and cancel an old screen while a newer intent exists. The first two
  clear the original intent; the third preserves the newer one. Build 33
  replaces build 32 for testing. These are synthetic screen-handler checks,
  not native-device results.

## Separate functional passes from release security

- Observation: successful sign-in/recovery and a saved review branch were
  described as completing the agreed checks, but a subsequent audit exposed
  callback-origin and implicit-flow risks outside those functional tests.
- Correction: label the verification scope explicitly. A functional pass does
  not close authentication trust boundaries, provider deletion integration,
  native storage, or public-release requirements. Skipped device checks remain
  skipped even when related SQL assertions pass.
- Transfer checks: an unrelated-origin callback and URL-supplied recovery type
  must not authenticate; wrong/missing PKCE verifiers must fail; failed secure
  storage migration must retain the old session for retry without publishing
  partial protected data. The build-29 automated tests exercise these cases.
  Actual native Keychain/provider flows remain pending until device testing.

## Test real return-address generation

- Observation: the build-29 integration fixture mocked Expo createURL by
  stripping a leading slash. The installed Expo implementation retains it in
  standalone links, producing three slashes. The server allowed only two-slash
  forms; strict callback validation then rejected the different return shape.
- Correction: execute the installed URL builder with controlled native manifest
  inputs and compare its exact output with the configured server allowlist.
  Mock native dependencies instead of replacing the transformation under test.
- Transfer checks: standalone sign-in and recovery addresses must both be
  explicitly allowed; Expo Go must still reject a different host or port; an
  unrelated origin must remain rejected. All four new regression tests pass.
  The live fix adds two exact addresses and preserves strict PKCE validation;
  native Google/Apple retesting remains separate evidence.

## Assess the requested subject

- Observation: a request to improve assistant quality became a founder-training
  tutorial. Correct tooling and polished documentation did not fix that mismatch.
- Correction: state whose work or knowledge is being assessed before producing
  the artifact. For this request, both workflows assess the assistant's work.
- Transfer check: a request to review a completed migration should produce
  evidence about that migration and its boundaries, not quiz the founder on SQL.
  The revised skills explicitly preserve this distinction. This is an artifact
  review, not a claim of proven behavior across future sessions.

## Review legacy access paths

- Observation: an initially narrow database review missed a legacy purchase
  function that bypassed paid-access restrictions. An isolated test demonstrated
  the issue; the approved permission fix was deployed and verified afterward.
- Correction: enumerate relevant exposed backend entry points during access
  reviews, including legacy functions, rather than infer security from the UI.
- Future check: document the role, callable route, controlled inputs, and
  observed server decision for the boundary being changed.

## Compare content reliably across platforms

- Observation: Windows line-ending conversion caused a deployment comparison
  to stop despite unchanged database definitions. The transaction rolled back.
- Correction: use reliable content checksums or deliberate normalization when
  line endings cross client/database boundaries; retain a real drift check.
- Future check: distinguish representation differences from semantic changes
  before retrying an operation. An unexpected mismatch is not permission to
  remove the safety check.
- Applied to monthly history: a snapshot equality test failed after changing
  the database session timezone. Scores and names were unchanged; JSON's
  timestamp representation differed. The API now emits an explicit UTC value.
  The original cross-timezone equality assertion remains and passes; checking
  the exact day-2 cutoff separately prevents formatting fixes from hiding a
  business-rule error.

## Verify the role used for schema introspection

- Observation: the Supabase Management API's restricted read-only route returned
  no rows from `information_schema.role_table_grants`, while the captured owner
  baseline had 499. That was visibility, not evidence that grants were removed.
- Correction: retain the drift check and compare with the same management role
  inside an explicitly read-only SQL transaction. Do not reinterpret a hidden
  catalog view as an empty set of permissions.
- Executed transfer check after the monthly migration: the restricted role saw
  zero grant rows and the owner saw 515; both explicit checks of the authenticated
  history RPC privilege returned true. Account for introspection role and use
  explicit privilege checks when assessing authorization.
