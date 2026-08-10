# Production Audit Fixes

This branch contains targeted fixes from the August 10, 2026 production audit:

- EXIF orientation is normalized before generation input is stored/sent to Vertex.
- Generation POST retries are idempotent by generation ID.
- Credit debits are idempotent by generation ID.
- Deleting incomplete generations refunds their debit idempotently.
- Stale-generation recovery has a protected scheduled safety endpoint.
- Vertex production logs no longer emit prompt contents by default.
- Gemini input media resolution is explicitly set to HIGH.
- The obsolete standalone `/api/uploads` endpoint and upload helper were removed.
