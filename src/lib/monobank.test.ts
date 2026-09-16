import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toKopecks, UAH_CCY, verifyPaidCallback } from "./monobank";
import type { Order } from "./types";

const order = (p: Partial<Order> = {}): Order =>
  ({ id: "VSL-1", total: 550, invoiceId: "inv-1", ...p }) as Order;

describe("money at the Monobank boundary", () => {
  test("hryvnia become kopecks with no floating-point drift", () => {
    assert.equal(toKopecks(550), 55000);
    assert.equal(toKopecks(12.34), 1234);
    assert.equal(toKopecks(0.1 + 0.2), 30);
  });
});

describe("the signature proves only that the callback came from Monobank", () => {
  test("a correct callback is accepted", () => {
    const check = verifyPaidCallback(order(), { amount: 55000, ccy: UAH_CCY, invoiceId: "inv-1" });
    assert.equal(check.ok, true);
  });

  test("the amount does not match — refused", () => {
    const check = verifyPaidCallback(order(), { amount: 100, ccy: UAH_CCY, invoiceId: "inv-1" });
    assert.equal(check.ok, false);
    assert.match((check as { reason: string }).reason, /amount/);
  });

  test("paid in another currency — refused", () => {
    const check = verifyPaidCallback(order(), { amount: 55000, ccy: 840, invoiceId: "inv-1" });
    assert.equal(check.ok, false);
    assert.match((check as { reason: string }).reason, /currency/);
  });

  test("a DIFFERENT invoice for the same order was paid — refused", () => {
    // This is the case that catches two live payment pages: the payment goes
    // through, but arrives with an invoice id the shop is no longer expecting.
    const check = verifyPaidCallback(order(), { amount: 55000, ccy: UAH_CCY, invoiceId: "inv-0" });
    assert.equal(check.ok, false);
    assert.match((check as { reason: string }).reason, /invoiceId/);
  });

  test("the amount is compared against the one the server computed", () => {
    const check = verifyPaidCallback(order({ total: 1 }), { amount: 55000, ccy: UAH_CCY, invoiceId: "inv-1" });
    assert.equal(check.ok, false, "a 1 UAH order cannot be settled by a 550 UAH payment");
  });

  test("an empty callback confirms nothing", () => {
    assert.equal(verifyPaidCallback(order(), {}).ok, false);
  });
});
