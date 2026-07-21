# Draft My Hair

# Feedback System

# Decision Log

Document
99-decision-log.md

Document ID
FB-099

Category
Decision Log

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

# Purpose

This document records significant architectural, product, and engineering decisions made during the design and evolution of the Draft My Hair Feedback System.

The purpose of this document is to preserve the reasoning behind important decisions so that future development remains consistent with the original design intent.

Only decisions with long-term architectural or product impact shall be recorded.

Minor implementation details shall not be included.

────────────────────────────────────────────────────────────────

Decision ID
FB-D001

Title

Feedback is Optional

Status

Accepted

Decision

Customers are never required to submit feedback before downloading or accessing their generated hairstyle.

Rationale

Mandatory feedback creates unnecessary friction and may reduce customer satisfaction.

Voluntary feedback is more likely to represent genuine customer opinions.

Consequences

• Better customer experience.

• Lower completion rate.

• Higher quality responses.

────────────────────────────────────────────────────────────────

Decision ID
FB-D002

Title

One Feedback Submission Per Generation

Status

Accepted

Decision

Each completed hairstyle generation may receive only one feedback submission.

Rationale

Prevent duplicate ratings and maintain reliable analytics.

Consequences

• Cleaner reporting.

• Simpler analytics.

• Better historical consistency.

────────────────────────────────────────────────────────────────

Decision ID
FB-D003

Title

Generation and Feedback Are Separate Entities

Status

Accepted

Decision

Generation records and Feedback records are stored as separate logical entities.

Rationale

A hairstyle generation exists regardless of whether the customer submits feedback.

Keeping these entities independent improves scalability and reporting.

Consequences

• Cleaner architecture.

• Simpler analytics.

• Better future extensibility.

────────────────────────────────────────────────────────────────

Decision ID
FB-D004

Title

Structured Feedback Before Free Text

Status

Accepted

Decision

The questionnaire prioritizes structured responses over open-ended comments.

Rationale

Structured responses produce more consistent analytics and simplify engineering prioritisation.

Consequences

• Higher quality reporting.

• Easier trend analysis.

• Reduced ambiguity.

────────────────────────────────────────────────────────────────

Decision ID
FB-D005

Title

Engineering Metadata Is Collected Automatically

Status

Accepted

Decision

Customers provide questionnaire responses only.

All engineering metadata is collected automatically by the system.

Rationale

Reduces customer effort while ensuring accurate engineering analysis.

Consequences

• Faster questionnaire completion.

• More reliable analytics.

• Lower risk of incorrect metadata.

────────────────────────────────────────────────────────────────

Decision ID
FB-D006

Title

Analytics Precede Dashboard Design

Status

Accepted

Decision

Analytics requirements are defined before designing the administrative dashboard.

Rationale

The dashboard exists to visualize analytics rather than define them.

Consequences

• Better architecture.

• Cleaner dashboard design.

• Reduced redesign effort.

────────────────────────────────────────────────────────────────

Decision ID
FB-D007

Title

Version-Aware Feedback

Status

Accepted

Decision

Every feedback submission shall remain permanently associated with the exact generation engine and questionnaire versions used during generation.

Rationale

Historical comparisons require immutable version references.

Consequences

• Reliable release evaluation.

• Accurate historical reporting.

• Better engineering decisions.

────────────────────────────────────────────────────────────────

Decision ID
FB-D008

Title

Privacy by Design

Status

Accepted

Decision

The Feedback System collects only information required for product improvement.

Rationale

Minimizing data collection improves customer trust and simplifies long-term privacy management.

Consequences

• Smaller data footprint.

• Reduced privacy risk.

• Simpler compliance.

────────────────────────────────────────────────────────────────

Decision ID
FB-D009

Title

Feedback Is a Core Product Subsystem

Status

Accepted

Decision

The Feedback System is treated as an independent product subsystem with its own specifications, database design, API, analytics, security requirements, and documentation.

Rationale

Customer feedback is fundamental to the continuous improvement strategy of Draft My Hair.

Consequences

• Modular architecture.

• Clear ownership.

• Easier future expansion.

────────────────────────────────────────────────────────────────

End of Document

Document Status

Draft Version 1.0.0

Awaiting Engineering Review