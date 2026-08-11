# Vertex retry fix

Transient Vertex generation failures (429/5xx/timeouts/network errors) are retried with exponential backoff and jitter in the generation service.
