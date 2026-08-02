const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

function pruneExpiredEntries(now: number) {
  for (const [ipAddress, entry] of attempts) {
    if (entry.resetAt <= now) {
      attempts.delete(ipAddress);
    }
  }

  while (attempts.size >= MAX_ENTRIES) {
    const oldestIpAddress = attempts.keys().next().value;

    if (!oldestIpAddress) {
      break;
    }

    attempts.delete(oldestIpAddress);
  }
}

export function checkContactRateLimit(ipAddress: string) {
  const now = Date.now();
  pruneExpiredEntries(now);

  const entry = attempts.get(ipAddress);

  if (!entry) {
    attempts.set(ipAddress, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000)
      ),
    };
  }

  entry.count += 1;

  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}
