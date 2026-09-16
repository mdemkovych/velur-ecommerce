import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getBadge } from "./getBadge";
import type { Product } from "./types";

const product = (p: Partial<Product>): Product =>
  ({ id: "p", slug: "s", name: "N", nameUk: "N", price: 500, category: "body",
     categoryNameUk: "Body", tagline: "", description: "", usage: "",
     specifications: [], media: [], image: "", images: [], stock: 5,
     packaging: "", isDeleted: false, components: [], ...p }) as Product;

describe("exactly one badge per card", () => {
  test("out of stock outranks everything", () => {
    const b = getBadge(product({ stock: 0, promotionalPrice: 400, badge: "BESTSELLER" }));
    assert.equal(b?.variant, "out_of_stock");
  });

  test("sale outranks a manual badge", () => {
    const b = getBadge(product({ promotionalPrice: 400, badge: "NEW" }));
    assert.equal(b?.variant, "sale");
    assert.equal(b?.text, "Sale");
  });

  test("a manual badge shows when nothing outranks it", () => {
    assert.equal(getBadge(product({ badge: "NEW" }))?.text, "New");
    assert.equal(getBadge(product({ badge: "BESTSELLER" }))?.text, "Bestseller");
  });

  test("an ordinary product carries no badge", () => {
    assert.equal(getBadge(product({})), null);
  });

  test("low stock does NOT produce a badge — that one was removed on purpose", () => {
    // If this test starts failing, somebody brought a "last few left" badge back.
    // Read §6.2 of `project-overview.md` before editing it.
    assert.equal(getBadge(product({ stock: 1 })), null);
    assert.equal(getBadge(product({ stock: 2 })), null);
  });
});
