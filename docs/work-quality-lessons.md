# Lessons for assistant work

Record observed gaps and concrete changes to the working method. This is not
a roadmap, confidence score, or claim that the model has been retrained.

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
