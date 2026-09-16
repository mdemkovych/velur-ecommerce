/**
 * Generates an SEO slug suggestion for new catalog items.
 *
 * NOTE: (§2.4) Used only as a starting suggestion for manual English entry.
 * Autotransliteration from Ukrainian is strictly avoided.
 *
 * @param englishName Latin product name.
 * @returns Normalized kebab-case slug string.
 */
export function slugSuggestion(englishName: string): string {
  return englishName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

