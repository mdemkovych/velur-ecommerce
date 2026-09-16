"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — the value flips once, at hydration. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Hydration-safe hook indicating whether component has mounted on client.
 *
 * Uses useSyncExternalStore to return false during SSR and true after initial client mount without cascading renders.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

