import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderOrderPaidSms } from "./turbosms";
import type { Order } from "./types";

/**
 * The length test is the one that matters. A Cyrillic message is 70 characters before
 * it splits into parts that are billed separately, and nothing about a two-part message
 * looks wrong from the outside — it arrives, it reads correctly, and it costs twice as
 * much on every paid order until somebody reads an invoice.
 */

/**
 * One SMS part in the GSM-7 alphabet the Latin message encodes to.
 *
 * A Cyrillic message would encode as UCS-2 and split at 70 instead, which is
 * less than half — the shorter ceiling is what shapes the wording when the shop
 * writes to Ukrainian customers.
 */
const SINGLE_PART_CHARS = 160;

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "VSL-20260822-A1B2C",
    createdAt: "2026-08-22T10:00:00.000Z",
    status: "PAID",
    customer: {
      firstName: "Olena",
      lastName: "Koval",
      phone: "+380961234567",
      email: "olena@example.com",
      city: "Kyiv",
      cityRef: "ref-city",
      deliveryMethod: "branch",
      branch: "Branch no. 12",
      branchRef: "ref-branch",
      address: "",
      paymentMethod: "mono",
    },
    items: [],
    total: 840,
    paymentAttempts: 1,
    needsReview: false,
    expiresAt: "2026-08-22T10:30:00.000Z",
    ...overrides,
  } as Order;
}

describe("the customer's payment confirmation", () => {
  it("fits one part, which is what keeps it one message", () => {
    assert.ok(
      renderOrderPaidSms(order()).length <= SINGLE_PART_CHARS,
      `over ${SINGLE_PART_CHARS} characters, so it is billed as two`,
    );
  });

  it("carries the order number, which is the whole reason it is sent", () => {
    assert.ok(renderOrderPaidSms(order()).includes("VSL-20260822-A1B2C"));
  });

  it("speaks of payment, not of an order that merely arrived", () => {
    assert.match(renderOrderPaidSms(order()), /paid/i);
  });
});
