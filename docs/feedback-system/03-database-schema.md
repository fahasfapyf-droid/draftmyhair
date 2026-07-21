# Draft My Hair

# Feedback System

# Database Schema

Document
03-database-schema.md

Document ID
FB-003

Category
Database Schema

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

This document defines the logical data structure required to support the Draft My Hair Feedback System.

Its purpose is to ensure that all feedback information is stored consistently, remains traceable to the originating hairstyle generation, and supports long-term analytics and engineering improvements.

This document defines logical entities, relationships, and required fields.

Database technology and implementation are documented separately.

────────────────────────────────────────────────────────────────

# 2. Design Principles

The Feedback database shall be designed according to the following principles.

• Every feedback belongs to one generation.

• Every generation may have zero or one feedback submission.

• Historical records are immutable.

• Engineering metadata is automatically captured.

• Customer responses remain separate from engineering metadata.

• Future schema expansion shall not require redesigning existing records.

────────────────────────────────────────────────────────────────

# 3. Core Entities

Version 1.0 consists of the following logical entities.

• Generation

• Feedback

• Feedback Version

• Hairstyle

────────────────────────────────────────────────────────────────

# 4. Generation Entity

Each hairstyle generation represents a single completed hairstyle preview.

Every generation shall have a unique identifier.

Required information includes:

• Generation ID

• Generation Timestamp

• Hairstyle

• Generation Status

• Generation Engine Version

• Master Prompt Version

• Hairstyle Specification Version

• Prompt Builder Version

• AI Model

• Processing Time

The Generation entity exists independently of customer feedback.

A generation may exist without a feedback submission.

────────────────────────────────────────────────────────────────

# 5. Feedback Entity

Each feedback record represents one customer evaluation of one hairstyle generation.

Required information:

• Feedback ID

• Generation ID

• Submission Timestamp

• Overall Satisfaction

• Identity Preservation

• Real-Life Decision

• Improvement Categories

• Optional Comments

• Questionnaire Version

Each Generation may have only one Feedback record.

────────────────────────────────────────────────────────────────

# 6. Feedback Version Entity

Every submitted questionnaire shall reference the version of the questionnaire used during submission.

Required information:

• Questionnaire Version

• Release Date

• Status

This allows historical comparison when future questionnaire revisions are introduced.

────────────────────────────────────────────────────────────────

# 7. Hairstyle Entity

Each hairstyle shall exist as a logical entity independent of customer feedback.

Required information:

• Hairstyle ID

• Hairstyle Name

• Category

• Active Status

• Current Specification Version

This allows analytics to group feedback by hairstyle.

────────────────────────────────────────────────────────────────

# 8. Entity Relationships

Generation

↓

0..1 Feedback

Generation

↓

1 Hairstyle

Feedback

↓

1 Questionnaire Version

Each Feedback record must reference exactly one Generation.

Each Generation must reference exactly one Hairstyle.

A Generation may exist without Feedback.

A Feedback record cannot exist without its Generation.

────────────────────────────────────────────────────────────────

# 9. Data Integrity Rules

Generation IDs shall be unique.

Feedback IDs shall be unique.

Historical feedback shall never be deleted.

Historical feedback shall never be reassigned to another generation.

Questionnaire versions shall remain immutable after release.

Engineering metadata shall not be editable by customers.

Customer responses shall not modify generation metadata.

────────────────────────────────────────────────────────────────

# 10. Future Expansion

The schema shall support future additions including:

• Screenshot attachments

• Multiple feedback revisions

• Hairdresser reviews

• AI-generated summaries

• Customer follow-up surveys

• Feature requests

Future additions shall remain backward compatible with Version 1.0.

────────────────────────────────────────────────────────────────

End of Document

Document Status

Draft Version 1.0.0

Awaiting Engineering Review