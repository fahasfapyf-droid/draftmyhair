# Draft My Hair

# Feedback System

# UI Specification

Document
05-ui-specification.md

Document ID
FB-005

Category
UI Specification

Subsystem
Feedback System

Version
1.0.0

Status
Draft

Owner
Draft My Hair

Last Updated
2026-07-18

────────────────────────────────────────────────────────────────

# 1. Purpose

This document defines the user interface requirements for the Draft My Hair Feedback System.

Its purpose is to ensure that every customer experiences a simple, consistent, and professional feedback interface regardless of device or future implementation changes.

This document specifies interface behaviour and presentation requirements.

Implementation details are documented separately.

────────────────────────────────────────────────────────────────

# 2. Design Objectives

The Feedback interface shall:

• Feel lightweight.

• Feel optional.

• Require minimal effort.

• Be visually consistent with the Draft My Hair brand.

• Encourage honest responses.

• Never distract from the generated hairstyle.

The interface should conclude the customer journey rather than interrupt it.

────────────────────────────────────────────────────────────────

# 3. Interface Placement

The Feedback section shall appear on the Result page.

It shall appear below the generated hairstyle preview and below the Download Image section.

The customer shall always encounter the Download option before the Feedback invitation.

Feedback shall never prevent downloading the generated image.

────────────────────────────────────────────────────────────────

# 4. Feedback Invitation

The interface shall begin with a short invitation.

Example wording:

"Help us improve Draft My Hair."

Supporting text:

"Your feedback helps us improve future hairstyle previews. This takes less than 20 seconds."

A Skip option shall always be available.

────────────────────────────────────────────────────────────────

# 5. Questionnaire Layout

The questionnaire shall be presented as a single, continuous form.

Questions shall appear in the following order:

1. Overall Satisfaction

2. Identity Preservation

3. Real-Life Decision

4. Improvement Areas
   (Displayed only when Overall Satisfaction is less than five stars.)

5. Additional Comments

A single Submit Feedback button concludes the questionnaire.

────────────────────────────────────────────────────────────────

# 6. Question Requirements

Overall Satisfaction

Input Type

Five-star rating.

Required

Yes.

────────────────────────────────────────────────────────────────

Identity Preservation

Input Type

Five-star rating.

Required

Yes.

────────────────────────────────────────────────────────────────

Real-Life Decision

Input Type

Single-choice selection.

Required

Yes.

────────────────────────────────────────────────────────────────

Improvement Areas

Input Type

Multi-select.

Displayed only when required.

Required

No.

────────────────────────────────────────────────────────────────

Additional Comments

Input Type

Multi-line text.

Maximum Length

500 characters.

Required

No.

────────────────────────────────────────────────────────────────

# 7. Submission Behaviour

The Submit Feedback button shall remain disabled until all required questions have been completed.

Upon submission:

• Inputs become read-only.

• The system submits the questionnaire.

• A loading indicator is displayed.

After successful submission:

• The questionnaire is replaced with a confirmation message.

Customers shall not be permitted to submit feedback multiple times for the same generation.

────────────────────────────────────────────────────────────────

# 8. Confirmation Screen

Following successful submission, the interface shall display a confirmation message.

Example:

"Thank you for your feedback."

Supporting text:

"Your feedback helps us improve future hairstyle previews."

No additional action is required from the customer.

────────────────────────────────────────────────────────────────

# 9. Error Handling

Validation errors shall clearly identify the missing or invalid information.

Technical error messages shall never be shown directly to customers.

If submission fails unexpectedly, the customer shall be invited to try again.

Previously entered responses should remain available whenever possible.

────────────────────────────────────────────────────────────────

# 10. Accessibility

The Feedback interface shall support:

• Keyboard navigation.

• Screen readers.

• Clear focus indicators.

• High contrast text.

• Mobile-friendly interaction.

Accessibility requirements apply equally across desktop, tablet, and mobile devices.

────────────────────────────────────────────────────────────────

# 11. Future Expansion

The interface has been intentionally designed to allow future additions without redesigning the overall customer experience.

Potential future additions include:

• Screenshot uploads.

• Image annotations.

• Follow-up surveys.

• Feature requests.

• AI-assisted feedback summaries.

Future additions shall preserve the simplicity of Version 1.0.

────────────────────────────────────────────────────────────────

End of Document

Document Status

Draft Version 1.0.0

Awaiting Engineering Review