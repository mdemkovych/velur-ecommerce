import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class names with Tailwind class merge conflict resolution.
 *
 * @param inputs Class name values, objects, or arrays.
 * @returns Merged deduplicated className string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

