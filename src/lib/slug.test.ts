import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { slugSuggestion } from "./slug";
import { productSchema } from "./validation";

describe("the address is suggested from the English name", () => {
  test("spaces become hyphens, case is dropped", () => {
    assert.equal(slugSuggestion("Body Cream"), "body-cream");
    assert.equal(slugSuggestion("Lip Balm No 1"), "lip-balm-no-1");
  });

  test("no stray separators are left at the edges", () => {
    assert.equal(slugSuggestion("  Hand Cream!  "), "hand-cream");
    assert.equal(slugSuggestion("Set — L"), "set-l");
  });

  test("an empty name does not produce a lone hyphen", () => {
    assert.equal(slugSuggestion(""), "");
    assert.equal(slugSuggestion("   "), "");
  });

  test("what it suggests is what the save will accept", () => {
    // Against `productSchema` itself, not a copy of its pattern: a suggestion
    // the editor cannot save is a form that rejects what it just filled in.
    for (const name of ["Body Cream", "Set — L", "Lip Balm No 1", "Скраб"]) {
      const suggested = slugSuggestion(name);
      if (!suggested) continue;
      const parsed = productSchema.shape.slug.safeParse(suggested);
      assert.equal(parsed.success, true, `${name} -> ${suggested}`);
    }
  });
});
