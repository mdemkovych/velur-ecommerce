/**
 * Distributed and in-memory fixed-window rate limiter.
 *
 * NOTE: (§3.2, §9.7) Uses Upstash Redis REST pipeline with in-memory map fallback.
 * Evaluates both local and distributed states to prevent fail-open vulnerabilities on serverless instances.
 */

export interface RateLimitRule {
  /** Bucket key prefix. */
  key: string;
  /** Maximum allowed requests within the time window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

// NOTE: (§3.3) The shortest wait in the project: this runs before every matched request.
const UPSTASH_TIMEOUT_MS = 2_000;

let credentialsWarned = false;

function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url && !token) return null;
  if (url?.startsWith("http") && token) return { url, token };

  if (!credentialsWarned) {
    credentialsWarned = true;
    console.error(
      "Upstash is configured but unusable — rate limits are per-instance, which on " +
        "serverless is barely a limit at all. " +
        (url && !url.startsWith("http")
          ? `UPSTASH_REDIS_REST_URL does not start with "http" (it begins with ${JSON.stringify(url.slice(0, 1))}) — ` +
            "a value copied with its surrounding quotes does exactly this."
          : "UPSTASH_REDIS_REST_TOKEN is missing while the URL is set."),
    );
  }
  return null;
}

interface Counter {
  count: number;
  expiresAt: number;
}

const memoryCounters = new Map<string, Counter>();

function checkInMemory(id: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const existing = memoryCounters.get(id);

  if (!existing || now > existing.expiresAt) {
    memoryCounters.set(id, { count: 1, expiresAt: now + rule.windowSeconds * 1000 });
    if (memoryCounters.size > 10_000) {
      for (const [key, counter] of memoryCounters) {
        if (now > counter.expiresAt) memoryCounters.delete(key);
      }
    }
    return false;
  }

  existing.count += 1;
  return existing.count > rule.limit;
}

async function checkUpstash(id: string, rule: RateLimitRule): Promise<boolean | null> {
  const creds = upstashCredentials();
  if (!creds) return null;
  const { url, token } = creds;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      body: JSON.stringify([
        ["INCR", id],
        ["EXPIRE", id, rule.windowSeconds, "NX"],
      ]),
    });

    if (!res.ok) {
      console.error(
        `Upstash rate limit refused the write (HTTP ${res.status}), falling back to the ` +
          "local counter. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
      return null;
    }

    const [incr] = (await res.json()) as { result: number }[];
    return typeof incr?.result === "number" ? incr.result > rule.limit : null;
  } catch (err) {
    console.error("Upstash rate limit unavailable, falling back to the local counter:", err);
    return null;
  }
}

/** Reads counter value without incrementing. */
async function peekUpstash(id: string): Promise<number | null> {
  const creds = upstashCredentials();
  if (!creds) return null;
  const { url, token } = creds;

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `Upstash rate limit refused the read (HTTP ${res.status}), falling back to the ` +
          "local counter. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
      return null;
    }
    const { result } = (await res.json()) as { result: string | null };
    return result === null ? 0 : Number(result);
  } catch (err) {
    console.error("Upstash rate limit peek failed, falling back to the local counter:", err);
    return null;
  }
}

/**
 * Inspects whether the identifier has exceeded limit without incrementing counter.
 *
 * NOTE: (§3.2) Used for account-based login throttling where only failed attempts increment.
 *
 * @param identifier Client IP or account identifier.
 * @param rule Rate limit configuration.
 * @returns True if over threshold; false otherwise.
 */
export async function isOverLimit(identifier: string, rule: RateLimitRule): Promise<boolean> {
  const id = `ratelimit:${rule.key}:${identifier}`;

  const distributed = await peekUpstash(id);
  if (distributed !== null && distributed >= rule.limit) return true;

  const local = memoryCounters.get(id);
  return Boolean(local && Date.now() <= local.expiresAt && local.count >= rule.limit);
}

/**
 * Increments rate limit attempt counter across in-memory and Redis backends.
 *
 * @param identifier Client IP or account identifier.
 * @param rule Rate limit configuration.
 */
export async function recordAttempt(identifier: string, rule: RateLimitRule): Promise<void> {
  const id = `ratelimit:${rule.key}:${identifier}`;
  checkInMemory(id, rule);
  await checkUpstash(id, rule);
}

/**
 * Resets attempt counters upon successful authorization.
 *
 * NOTE: (§3.2) Successful logins clear failed attempt tallies.
 *
 * @param identifier Client IP or account identifier.
 * @param rule Rate limit configuration.
 */
export async function clearAttempts(identifier: string, rule: RateLimitRule): Promise<void> {
  const id = `ratelimit:${rule.key}:${identifier}`;
  memoryCounters.delete(id);

  const creds = upstashCredentials();
  if (!creds) return;
  const { url, token } = creds;

  try {
    await fetch(`${url}/del/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
  } catch {
    // Fail-safe: Redis TTL will expire bucket automatically.
  }
}

/**
 * Atomically checks and increments rate limit counter.
 *
 * NOTE: (§3.2) Combines distributed and in-memory checks via logical OR to ensure fail-closed enforcement.
 *
 * @param identifier Target IP or token.
 * @param rule Rate limit configuration.
 * @returns True if request exceeds threshold; false if allowed.
 */
export async function isRateLimited(identifier: string, rule: RateLimitRule): Promise<boolean> {
  const id = `ratelimit:${rule.key}:${identifier}`;
  const local = checkInMemory(id, rule);
  const distributed = await checkUpstash(id, rule);
  return distributed === true || local;
}

