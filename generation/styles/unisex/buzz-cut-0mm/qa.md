# 0.0 mm Buzz Cut — QA Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the result is a genuine zero-guard buzz cut and clearly distinct from baldness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Category | Score |
|---|---:|
| Identity Preservation | |
| Face Preservation | |
| Pose Preservation | |
| Skull Geometry | |
| Buzz Cut Accuracy | |
| Follicular Realism | |
| Scalp Realism | |
| Hairline Preservation | |
| Lighting Integration | |
| Overall Realism | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LENGTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• extremely short stubble
• no long hair
• no completely hairless areas
• no obvious longer buzz sections

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BALD DISTINCTION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS only if subtle follicular hair remains visible.

FAIL if:

• scalp appears completely hairless
• follicular density disappears
• result looks like clean bald

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLICLE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Accept:

• irregular density
• subtle local variation
• different follicle directions
• natural optical darkness

Reject:

• visible dot grid
• repeated patterns
• procedural noise
• uniform darkness
• synthetic stippling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HAIRLINE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• original frontal contour
• original temple recession
• original widow's peak
• original sideburn position

FAIL if the hairline has been redesigned.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROWN CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• natural crown whorl
• subtle directional variation
• no flattened artificial texture

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCALP CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• source-consistent skin tone
• natural pores
• natural texture
• subtle oil variation
• realistic follicular shadows

Reject:

• grey overlay
• plastic skin
• waxy skin
• excessive smoothing
• artificial gloss

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EAR CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• ear geometry unchanged
• natural stubble termination
• no carved openings
• no masking artifacts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALISM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The result should pass:

"Does this look like the same person immediately after a zero-guard clipper cut?"

If not, identify whether the failure is:

• length
• follicle density
• scalp tonality
• hairline
• lighting
• geometry
• texture

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum production threshold:

Overall ≥ 9.4

Identity ≥ 9.5

Pose ≥ 9.5

Geometry ≥ 9.5

Buzz Accuracy ≥ 9.5

Follicular Realism ≥ 9.5

Scalp Realism ≥ 9.5

If satisfied, retain v1.

If below threshold, perform ONE targeted refinement only.