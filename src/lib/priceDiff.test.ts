import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { moneyChanges, moneySnapshot } from "./priceDiff";

const snap = (price: string, promo = "", stock = "10") => moneySnapshot(price, promo, stock);

describe("what the manager is shown before the money fields are saved", () => {
  test("no previous state means nothing to ask about — this is a new product", () => {
    assert.deepEqual(moneyChanges(snap("500"), null), []);
  });

  test("nothing changed — save without asking", () => {
    assert.deepEqual(moneyChanges(snap("500"), snap("500")), []);
  });

  test("a price change names both figures", () => {
    const [c] = moneyChanges(snap("600"), snap("500"));
    assert.deepEqual(c, { what: "Price", from: "500 ₴", to: "600 ₴" });
  });

  test("a promotion is switched on", () => {
    const [c] = moneyChanges(snap("500", "400"), snap("500", ""));
    assert.deepEqual(c, { what: "Promotional price", from: "none", to: "400 ₴" });
  });

  test("a promotion is switched off", () => {
    const [c] = moneyChanges(snap("500", ""), snap("500", "400"));
    assert.deepEqual(c, { what: "Promotional price", from: "400 ₴", to: "none" });
  });

  test("a stock change", () => {
    const [c] = moneyChanges(snap("500", "", "3"), snap("500", "", "10"));
    assert.deepEqual(c, { what: "Stock", from: "10 pcs", to: "3 pcs" });
  });

  test("several changes are listed together", () => {
    assert.equal(moneyChanges(snap("600", "500", "3"), snap("500", "", "10")).length, 3);
  });
});
