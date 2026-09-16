"use client";

import { useEffect, useState } from "react";

/**
 * NOTE: (§3.2) The delivery limit is sized on the assumption that entering an
 * address costs five to eight requests, which holds only because the lookups
 * are debounced.
 *
 * MUST NOT: shorten this to nothing; a request per keystroke blows that budget
 * on a handful of shoppers, and a 429 on the address field drops them to
 * hand-typed delivery (§5.2).
 *
 * Returns debounced value after specified delay in milliseconds.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

