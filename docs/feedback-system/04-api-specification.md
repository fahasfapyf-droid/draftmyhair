# Draft My Hair

# Feedback System

# API Specification

Document
04-api-specification.md

Document ID
FB-004

Category
API Specification

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

This document defines the application programming interface (API) requirements for the Draft My Hair Feedback System.

Its purpose is to standardize communication between the user interface and the backend services responsible for storing, validating, and retrieving feedback data.

This document defines API behavior only.

Implementation details, routing, authentication mechanisms, database queries, and framework-specific code are documented separately.

────────────────────────────────────────────────────────────────

# 2. Objectives

The Feedback API shall support the following objectives.

• Receive customer feedback.

• Validate submitted responses.

• Store validated feedback.

• Prevent duplicate submissions.

• Return clear success or failure responses.

• Support future analytics and reporting.

────────────────────────────────────────────────────────────────

# 3. API Principles

The Feedback API shall follow these principles.

• Simple

• Predictable

• Secure

• Idempotent

• Versioned

• Backward compatible where practical

The API shall expose only the functionality required by the Feedback System.

────────────────────────────────────────────────────────────────

# 4. Operations

Version 1.0 supports the following operations.

Submit Feedback

Validate Feedback

Retrieve Questionnaire Version

Check Feedback Status

Future operations require specification updates.

────────────────────────────────────────────────────────────────

# 5. Submit Feedback

Purpose

Receive a completed customer questionnaire.

Input

The request shall include:

• Generation Identifier

• Overall Satisfaction

• Identity Preservation

• Real-Life Decision

• Improvement Categories (optional)

• Additional Comments (optional)

The backend shall automatically associate the submission with the relevant engineering metadata.

The client shall not submit engineering metadata.

Output

Successful submission returns confirmation.

Failed submission returns validation information.

────────────────────────────────────────────────────────────────

# 6. Validate Feedback

Before storing feedback, the API shall verify:

• Generation exists.

• Feedback has not already been submitted.

• Required questions are completed.

• Rating values are valid.

• Questionnaire version is supported.

Invalid submissions shall not be stored.

────────────────────────────────────────────────────────────────

# 7. Retrieve Questionnaire Version

The frontend may request the currently active questionnaire version.

This allows future questionnaire revisions without requiring frontend redesign.

────────────────────────────────────────────────────────────────

# 8. Check Feedback Status

The frontend may determine whether feedback has already been submitted for a generation.

Possible outcomes include:

• Not Submitted

• Already Submitted

• Generation Not Found

This prevents duplicate feedback submissions.

────────────────────────────────────────────────────────────────

# 9. Error Handling

Errors shall be predictable and understandable.

Examples include:

• Invalid Generation

• Missing Required Fields

• Invalid Rating Value

• Unsupported Questionnaire Version

• Duplicate Submission

Internal implementation details shall never be exposed to customers.

────────────────────────────────────────────────────────────────

# 10. Security Principles

The Feedback API shall reject malformed or invalid requests.

Customer input shall always be validated before processing.

Only the questionnaire fields submitted by the customer shall be accepted.

Engineering metadata shall be generated exclusively by the backend.

No customer shall be permitted to modify generation metadata.

────────────────────────────────────────────────────────────────

# 11. Future Expansion

Future API capabilities may include:

• Screenshot uploads

• Feedback updates

• Customer feature requests

• AI-assisted summaries

• Administrator moderation

• Analytics endpoints

Future additions shall remain compatible with Version 1.0 whenever practical.

────────────────────────────────────────────────────────────────

End of Document

Document Status

Draft Version 1.0.0

Awaiting Engineering Review