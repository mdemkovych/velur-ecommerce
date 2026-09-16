import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderNewOrderMessage } from "./telegram";
import type { Order } from "./types";

/**
 * The message is what the shop packs and dispatches from, so most of these
 * check that everything needed to address a parcel survives rendering. The
 * escaping test guards the rest: without one, a field added later without
 * `escapeHtml` looks exactly like the fields around it.
 */

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
      address: "Khreshchatyk St, 1, apt. 5",
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

describe("the owner's notice that an order arrived", () => {
  it("carries the customer, because somebody has to address the parcel", () => {
    const text = renderNewOrderMessage(order());

    assert.ok(text.includes("Olena"), "first name");
    assert.ok(text.includes("Koval"), "surname");
    assert.ok(text.includes("+380961234567"), "telephone — the field they act on");
    assert.ok(text.includes("olena@example.com"), "email");
  });

  it("gives the street for courier delivery and the branch otherwise", () => {
    const branch = renderNewOrderMessage(order());
    assert.ok(branch.includes("Branch no. 12"), "the branch it goes to");
    assert.ok(!branch.includes("Khreshchatyk"), "a branch order is not addressed to a street");

    const courier = renderNewOrderMessage(
      order({ customer: { ...order().customer, deliveryMethod: "courier" } }),
    );
    assert.ok(courier.includes("Khreshchatyk"), "a courier cannot deliver without the street");
    assert.ok(courier.includes("courier"), "the delivery method has to be visible");
    assert.ok(courier.includes("Kyiv"), "the city, always");
  });

  it("carries enough to walk to the shelf with", () => {
    const text = renderNewOrderMessage(order());

    assert.ok(text.includes("VSL-20260822-A1B2C"), "the number, to find it in the panel");
    assert.ok(text.includes("Shower gel"), "what exactly to pack");
    assert.ok(text.includes("2 pcs"), "how many");
    assert.ok(text.includes("840"), "what it came to");
  });

  it("shows the comment when there is one", () => {
    const text = renderNewOrderMessage(
      order({ customer: { ...order().customer, comment: "Call before dispatch" } }),
    );
    assert.ok(text.includes("Call before dispatch"));
  });

  it("omits the comment heading when the customer wrote nothing", () => {
    // An empty heading reads as a field that failed to render rather than as a
    // customer with nothing to add.
    assert.ok(!renderNewOrderMessage(order()).includes("Comment"));
    assert.ok(
      !renderNewOrderMessage(
        order({ customer: { ...order().customer, comment: "   " } }),
      ).includes("Comment"),
      "whitespace is not a comment",
    );
  });

  it("escapes the customer's comment — free text, parsed as HTML", () => {
    // The one customer field with no character restriction behind it: a name
    // is Cyrillic-only and a phone is digits, so this is where markup arrives.
    const text = renderNewOrderMessage(
      order({
        customer: {
          ...order().customer,
          comment: '<b>urgent</b> & <a href="http://evil">here</a>',
        },
      }),
    );

    assert.ok(!text.includes("<b>urgent</b>"), "markup from a customer must not run");
    assert.ok(!text.includes('<a href'), "nor a link they smuggled in");
    assert.ok(text.includes("&lt;b&gt;"), "tags have to be escaped");
    assert.ok(text.includes("&amp;"), "the ampersand too — Telegram refuses otherwise");
  });

  it("escapes the customer's own name as well", () => {
    const text = renderNewOrderMessage(
      order({ customer: { ...order().customer, lastName: "<i>Koval</i>" } }),
    );
    assert.ok(!text.includes("<i>Koval</i>"), "a name is typed by a stranger too");
    assert.ok(text.includes("&lt;i&gt;"), "escaped instead");
  });

  it("escapes the product name — the message is parsed as HTML", () => {
    const injected = order({
      items: [
        {
          id: "l1",
          productId: "p1",
          nameUk: "<b>Cream</b> & serum",
          price: 100,
          quantity: 1,
          returnedQuantity: 0,
          restockedQuantity: 0,
        },
      ],
    } as Partial<Order>);

    const text = renderNewOrderMessage(injected);
    assert.ok(!text.includes("<b>Cream</b>"), "markup from the catalogue must not run");
    assert.ok(text.includes("&lt;b&gt;"), "tags have to be escaped");
    assert.ok(text.includes("&amp;"), "the ampersand too — Telegram refuses otherwise");
  });
});
