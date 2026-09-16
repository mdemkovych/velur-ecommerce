"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * Nova Poshta city and warehouse directory autocomplete hooks.
 *
 * NOTE: (§1.2, §5.1, §5.3) Proxies requests through internal /api/delivery routes keeping API credentials server-side.
 */

export interface NpCity {
  ref: string;
  name: string;
  area: string;
}

export interface NpWarehouse {
  ref: string;
  description: string;
}

interface LookupState<T> {
  options: T[];
  isLoading: boolean;
  isDirectoryAvailable: boolean;
}

interface Resolved<T> {
  /** The request this result belongs to; `null` before anything resolved. */
  url: string | null;
  options: T[];
  isDirectoryAvailable: boolean;
}

function useLookup<T>(url: string | null, collection: string): LookupState<T> {
  const [resolved, setResolved] = useState<Resolved<T>>({
    url: null,
    options: [],
    isDirectoryAvailable: true,
  });

  useEffect(() => {
    if (!url) return;

    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then((res) => {
        // Validates HTTP status before parsing JSON to prevent rate limit false positives.
        if (!res.ok) throw new Error(`lookup failed: HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { configured?: boolean; available?: boolean } & Record<string, T[]>) => {
        setResolved({
          url,
          options: (data[collection] as T[] | undefined) ?? [],
          // NOTE: (§5.2) Tracks directory availability for fallback manual address entry.
          isDirectoryAvailable: data.configured !== false && data.available !== false,
        });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        // NOTE: (§5.2) A failure is not an empty result; the flag is what the form relaxes on.
        console.warn("Nova Poshta lookup failed:", err);
        setResolved((prev) => ({ ...prev, url, options: [] }));
      });

    return () => controller.abort();
  }, [url, collection]);

  const isCurrent = resolved.url === url;
  return {
    options: isCurrent ? resolved.options : [],
    isLoading: url !== null && !isCurrent,
    isDirectoryAvailable: resolved.isDirectoryAvailable,
  };
}

export function useCitySearch(query: string): LookupState<NpCity> {
  const debounced = useDebouncedValue(query.trim(), 350);
  const url = debounced.length >= 2 ? `/api/delivery/cities?q=${encodeURIComponent(debounced)}` : null;
  return useLookup<NpCity>(url, "cities");
}

export function useWarehouseSearch(cityRef: string, query: string): LookupState<NpWarehouse> {
  const debounced = useDebouncedValue(query.trim(), 350);
  const url = cityRef
    ? `/api/delivery/warehouses?cityRef=${encodeURIComponent(cityRef)}&q=${encodeURIComponent(debounced)}`
    : null;
  return useLookup<NpWarehouse>(url, "warehouses");
}

