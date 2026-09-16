import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderOrderPaidEmail } from "./mail";
import type { Order } from "./types";

/**
 * The letter is a pure function of an order, so it can be held still without a
 * mail provider, a network or a key. Two of these guard rules rather than
 * formatting: that a manager-typed name reaches an inbox escaped, and that no
 * letter ever links to an order (§3.1).
 */

const APP_URL = "https://velur.example";

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
      paymentMethod: "mono",
    },
    items: [
      {
        id: "l1",
        productId: "p1",
        nameUk: "Shower gel",
        price: 420,
        quantity: 2,
        returnedQuantity: 0,
        restockedQuantity: 0,
      },
    ],
    total: 840,
    paymentAttempts: 1,
    needsReview: false,
    expiresAt: "2026-08-22T10:30:00.000Z",
    ...overrides,
  } as Order;
}

describe("the order-paid letter", () => {
  it("carries the order number, in the subject and in the body alike", () => {
    const { subject, text, html } = renderOrderPaidEmail(order(), APP_URL);
    for (const part of [subject, text, html]) {
      assert.ok(part.includes("VSL-20260822-A1B2C"), "the number belongs everywhere");
    }
  });

  it("totals the line, not only the price of one unit", () => {
    const { text, html } = renderOrderPaidEmail(order(), APP_URL);
    // 2 × 420 = 840, in the total and in the line alike.
    assert.ok(html.includes("840"), "the line total belongs in the HTML");
    assert.ok(text.includes("840"), "the total belongs in the plain text");
  });

  it("escapes the product name — a manager types it and it lands in markup", () => {
    const injected = order({
      items: [
        {
          id: "l1",
          productId: "p1",
          nameUk: '<img src=x onerror="alert(1)">',
          price: 100,
          quantity: 1,
          returnedQuantity: 0,
          restockedQuantity: 0,
        },
      ],
    } as Partial<Order>);

    const { html } = renderOrderPaidEmail(injected, APP_URL);
    assert.ok(!html.includes("<img src=x"), "the tag must not stay a tag");
    assert.ok(html.includes("&lt;img"), "it has to be escaped");
    assert.ok(!html.includes('onerror="alert(1)"'), "the handler must not survive");
  });

  it("escapes the customer's name too — it also comes from a form", () => {
    const injected = order({
      customer: { ...order().customer, firstName: "<b>Olia</b>" },
    });
    const { html } = renderOrderPaidEmail(injected, APP_URL);
    assert.ok(!html.includes("<b>Olia</b>"), "markup from a form must not run");
    assert.ok(html.includes("&lt;b&gt;"), "it has to be escaped");
  });

  it("links to no order page — no such address exists, deliberately (§3.1)", () => {
    const { text, html } = renderOrderPaidEmail(order(), APP_URL);
    for (const part of [text, html]) {
      assert.ok(!part.includes("/orders/"), "no links to an order");
      assert.ok(!part.includes("orderId="), "and no identifiers in URLs either");
    }
  });

  it("names the branch for branch delivery", () => {
    const { text } = renderOrderPaidEmail(order(), APP_URL);
    assert.ok(text.includes("Kyiv, Branch no. 12"));
  });

  it("names the street address for courier delivery", () => {
    const courier = order({
      customer: {
        ...order().customer,
        deliveryMethod: "courier",
        branch: undefined,
        address: "Khreshchatyk St, 1, apt. 5",
      },
    });
    const { text } = renderOrderPaidEmail(courier, APP_URL);
    assert.ok(text.includes("Kyiv, Khreshchatyk St, 1, apt. 5"));
  });

  it("promises no parcel updates — Nova Poshta sends those", () => {
    const { text } = renderOrderPaidEmail(order(), APP_URL);
    assert.ok(
      text.includes("Nova Poshta will tell you"),
      "the letter has to say who the parcel news will come from",
    );
  });

  it("builds links from the app URL it was given, not a hard-coded one", () => {
    const { text } = renderOrderPaidEmail(order(), "https://example.test");
    assert.ok(text.includes("https://example.test/returns"));
    assert.ok(!text.includes("velur.example"));
  });
});
