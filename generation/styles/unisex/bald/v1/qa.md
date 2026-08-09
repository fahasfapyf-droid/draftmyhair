# Bald / Clean Shaved — QA Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the output looks like the same photograph of the same person with a completely shaved scalp.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Category | Score |
|---|---:|
| Identity Preservation | |
| Face Preservation | |
| Pose Preservation | |
| Skull Geometry | |
| Scalp Realism | |
| Follicle Realism | |
| Lighting Integration | |
| Background Integration | |
| Edge Integration | |
| Overall Realism | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HAIR REMOVAL CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• no visible hair mass
• no long strands
• no isolated hair remnants
• no artificial hairline

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCALP CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• natural skin tone
• natural texture
• subtle tonal variation
• realistic curvature
• natural matte-to-soft-satin response

FAIL if:

• grey overlay
• plastic appearance
• wax appearance
• artificial smoothness
• excessive gloss

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLICLE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Accept:

• subtle tonal density
• slightly stronger crown/temple perception
• natural localized variation

Reject:

• individual visible dots
• uniform dots
• stippling
• noise pattern
• artificial follicle grid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKULL CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• exact head width
• exact head length
• exact crown position
• exact forehead relationship
• exact ear relationship
• exact jaw and chin geometry

FAIL if the bald state appears to have created a different skull.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIGHTING CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• source lighting direction
• source exposure
• source white balance
• natural scalp shadow gradients
• source photographic grain

FAIL if the scalp appears to have been photographed under different lighting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKGROUND CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• reconstruction restricted to removed hair region
• surrounding background unchanged
• no halo
• no texture mismatch
• no colour spill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALISM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The final image should pass the simple test:

"Could this have been the original photograph before the subject's hair was present?"

If the answer is no, identify the exact visible failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum production threshold:

Overall ≥ 9.4

Identity ≥ 9.5

Pose ≥ 9.5

Geometry ≥ 9.5

Scalp Realism ≥ 9.5

Background Integration ≥ 9.4

If satisfied, retain v1.

If below threshold, perform ONE targeted refinement only.