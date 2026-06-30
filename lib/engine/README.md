# Draft My Hair Engine

## Purpose

The Draft My Hair Engine is responsible for transforming an uploaded customer photo into a photorealistic hairstyle preview.

The frontend must never communicate directly with AI providers.

All generation requests must pass through the engine.

---

## Architecture

Browser

↓

API Route

↓

Generation Service

↓

Prompt Builder

↓

AI Provider

↓

Validation

↓

Response

---

## Responsibilities

### API Route

- Receives HTTP requests
- Validates request format
- Calls the engine
- Returns JSON

### Generation Service

Coordinates the entire generation pipeline.

### Prompt Builder

Builds the final prompt by combining:

- Master Prompt
- Style Prompt

### AI Provider

Responsible for communicating with Gemini.

Future providers can be added without changing the frontend.

### Validation

Validates generation requests and generated results.

---

## Rules

- The frontend must never import provider files.
- The frontend must never call Gemini directly.
- Providers must never contain business logic.
- Prompt logic belongs only inside the Prompt Builder.
- Business logic belongs only inside the Generation Service.

---

## Long-term Goal

The engine should support:

- Multiple AI providers
- Multiple hairstyle collections
- QA pipeline
- Storage
- Salons
- Public API

without changing the frontend.