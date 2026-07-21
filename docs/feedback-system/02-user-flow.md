# Draft My Hair

# Feedback System

# User Flow

Document
02-user-flow.md

Document ID
FB-002

Category
User Flow

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

This document defines the complete user journey through the Draft My Hair Feedback System.

Its purpose is to ensure that every customer experiences a consistent, intuitive, and friction-free feedback process.

This document defines user interactions and business behavior only.

Visual design, component layout, animations, and implementation details are documented separately.

────────────────────────────────────────────────────────────────

# 2. Design Goals

The Feedback System user flow shall:

• Never interrupt the customer.

• Never block image download.

• Require minimal effort.

• Collect high-quality engineering data.

• Respect customer privacy.

• Feel like a natural conclusion to the hairstyle generation process.

────────────────────────────────────────────────────────────────

# 3. Entry Point

The customer enters the Feedback System immediately after a successful hairstyle generation.

The generated hairstyle preview has already been displayed.

The customer has already received access to download the generated image.

Feedback is presented as an optional next step.

The customer is never forced to participate.

────────────────────────────────────────────────────────────────

# 4. User Journey

The Feedback System follows the sequence below.

Generation Completed

↓

Result Page Displayed

↓

Download Image Available

↓

Feedback Invitation Displayed

↓

Customer Decision

├── Skip Feedback
│
│     ↓
│
│   Session Ends
│
└── Provide Feedback
      ↓
      Complete Questionnaire
      ↓
      Submit Feedback
      ↓
      Thank You Message
      ↓
      Session Ends

────────────────────────────────────────────────────────────────

# 5. Customer Decision

Customers have two choices.

Option 1

Skip Feedback

The customer leaves the page.

No questionnaire is completed.

No negative assumptions shall be made.

Skipping feedback does not imply dissatisfaction.

────────────────────────────────────────────────────────────────

Option 2

Submit Feedback

The customer completes the questionnaire.

The system validates the responses.

The feedback is stored.

The session concludes with a confirmation message.

────────────────────────────────────────────────────────────────

# 6. User Experience Principles

The feedback process shall feel:

• Fast

• Optional

• Professional

• Respectful

• Non-intrusive

Customers should never feel pressured to submit feedback.

The system shall thank customers regardless of the rating they provide.

────────────────────────────────────────────────────────────────

# 7. Completion

After successful submission:

• Feedback is stored.

• Analytics are updated.

• The customer receives a confirmation message.

No additional questions are presented.

The feedback session is complete.

────────────────────────────────────────────────────────────────

End of Document

Document Status

Draft Version 1.0.0

Awaiting Engineering Review