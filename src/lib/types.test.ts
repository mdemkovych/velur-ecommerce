import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  bannerTitleScale, canRecordReturn, cartLinePrice, chargedPrice, canTransition, goodsHaveLeft, isAdminRole, isManualOrderStatus,
  lineNetTotal, noticeBlocksCheckout, orderNetTotal, orderRefundedTotal,
  orderReturnState, ORDER_TRANSITIONS, PAYMENT_WINDOW_MINUTES,
  PENDING_PAYMENT_TTL_MINUTES, regularPrice, type OrderItem,
} from "./types";

const line = (p: Partial<OrderItem>): OrderItem => ({
  id: "l", productId: "p", nameUk: "Product", price: 100, quantity: 1,
  returnedQuantity: 0, restockedQuantity: 0, ...p,
});

describe("what the customer actually pays", () => {
  test("no promotion — the ordinary price", () => {
    assert.equal(chargedPrice({ price: 500 }), 500);
    assert.equal(regularPrice({ price: 500 }), undefined);
  });

  test("with a promotion the discounted price is charged and the ordinary one is struck through", () => {
    assert.equal(chargedPrice({ price: 500, promotionalPrice: 400 }), 400);
    assert.equal(regularPrice({ price: 500, promotionalPrice: 400 }), 500);
  });

  test("a basket line is priced by the same function", () => {
    const product = { price: 500, promotionalPrice: 400 } as never;
    assert.equal(cartLinePrice({ product, quantity: 3 }), 400);
  });
});

describe("how much of the money the shop kept", () => {
  test("no returns — the whole sum", () => {
    const order = { total: 300, items: [line({ price: 100, quantity: 3 })] };
    assert.equal(orderRefundedTotal(order.items), 0);
    assert.equal(orderNetTotal(order), 300);
  });

  test("a partial return lowers the turnover, not the order total", () => {
    const order = { total: 300, items: [line({ price: 100, quantity: 3, returnedQuantity: 1 })] };
    assert.equal(orderRefundedTotal(order.items), 100);
    assert.equal(orderNetTotal(order), 200);
    assert.equal(order.total, 300, "the original sum is untouched — it is the audit trail");
  });

  test("a full return zeroes the turnover", () => {
    const order = { total: 300, items: [line({ price: 100, quantity: 3, returnedQuantity: 3 })] };
    assert.equal(orderNetTotal(order), 0);
  });

  test("after a return a line is worth what is left of it", () => {
    assert.equal(lineNetTotal(line({ price: 100, quantity: 3, returnedQuantity: 1 })), 200);
  });
});

describe("the return state is derived from the lines, never stored", () => {
  test("nothing was returned", () => {
    assert.equal(orderReturnState([line({ quantity: 2 })]), "none");
  });
  test("part was returned — the order is still alive", () => {
    assert.equal(orderReturnState([line({ quantity: 3, returnedQuantity: 1 })]), "partial");
  });
  test("everything was returned", () => {
    assert.equal(orderReturnState([line({ quantity: 2, returnedQuantity: 2 })]), "full");
  });
  test("partially, across several lines", () => {
    assert.equal(
      orderReturnState([line({ quantity: 2, returnedQuantity: 2 }), line({ quantity: 2 })]),
      "partial",
    );
  });
});

describe("the status transition table", () => {
  test("PAID cannot be set by hand from any status", () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      assert.ok(
        !(targets as readonly string[]).includes("PAID"),
        `${from} must not offer PAID — only applyPayment writes money`,
      );
    }
  });

  test("an unpaid order cannot be shipped", () => {
    assert.equal(canTransition("PENDING_PAYMENT", "SHIPPED"), false);
    assert.equal(canTransition("PENDING_PAYMENT", "CANCELLED"), true);
  });

  test("a paid order can be shipped or cancelled", () => {
    assert.equal(canTransition("PAID", "SHIPPED"), true);
    assert.equal(canTransition("PAID", "CANCELLED"), true);
    assert.equal(canTransition("PAID", "RETURNED"), false);
  });

  test("delivered and returned lead nowhere further", () => {
    assert.equal(canTransition("DELIVERED", "RETURNED"), true);
    assert.equal(canTransition("DELIVERED", "CANCELLED"), false);
  });

  test("a SHIPPED order cannot be cancelled — only delivered or returned", () => {
    // If this starts passing, a dispatched parcel can be cancelled and its
    // goods offered for sale while they are still in a van (§4.5).
    assert.equal(canTransition("SHIPPED", "CANCELLED"), false);
    assert.equal(canTransition("SHIPPED", "RETURNED"), true);
    assert.equal(canTransition("SHIPPED", "DELIVERED"), true);
    assert.deepEqual(ORDER_TRANSITIONS.CANCELLED, []);
    assert.deepEqual(ORDER_TRANSITIONS.RETURNED, []);
  });

  test("PAID is not a status a manager sets", () => {
    assert.equal(isManualOrderStatus("PAID"), false);
    assert.equal(isManualOrderStatus("SHIPPED"), true);
  });
});

describe("which statuses a return can be recorded from", () => {
  test("the goods have to reach the customer first", () => {
    assert.equal(canRecordReturn("SHIPPED"), true);
    assert.equal(canRecordReturn("DELIVERED"), true);
  });

  test("lines are still editable after the order is marked «Returned»", () => {
    // Marking the order returned is half the job: the manager then ticks
    // «Return the goods to sale» line by line, and that is this same path.
    assert.equal(canRecordReturn("RETURNED"), true);
  });

  test("from CANCELLED — no, cancelling already credited the shelf", () => {
    // If this test starts failing, double-crediting of stock is back:
    // cancelOrder has already put every unit back on the shelf.
    assert.equal(canRecordReturn("CANCELLED"), false);
  });

  test("from PAID — yes: the customer drops a line before the parcel goes", () => {
    // Safe only because cancelOrder credits quantity − restockedQuantity. If
    // that subtraction goes, this permission has to go with it.
    assert.equal(canRecordReturn("PAID"), true);
  });

  test("from PENDING_PAYMENT — no, nothing is sold yet", () => {
    // The reservation returns on its own when the order lapses.
    assert.equal(canRecordReturn("PENDING_PAYMENT"), false);
  });
});

describe("whether the goods have left decides wording, not access", () => {
  test("before dispatch it is striking a line off; after, it is a return", () => {
    assert.equal(goodsHaveLeft("PAID"), false);
    assert.equal(goodsHaveLeft("SHIPPED"), true);
    assert.equal(goodsHaveLeft("DELIVERED"), true);
    assert.equal(goodsHaveLeft("RETURNED"), true);
  });

  test("permission is wider than \"goods have left\" by exactly PAID", () => {
    // If these two diverge anywhere else, the screen calls the event by the
    // wrong word, and the «Return the goods to sale» tick starts in the wrong state.
    for (const status of ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const) {
      if (goodsHaveLeft(status)) assert.equal(canRecordReturn(status), true);
    }
  });
});

describe("the reservation must outlive the invoice at the bank", () => {
  test("the payment window is shorter than the reservation", () => {
    assert.ok(
      PENDING_PAYMENT_TTL_MINUTES > PAYMENT_WINDOW_MINUTES,
      "otherwise the goods go back on the shelf while the customer is still paying",
    );
  });
});

describe("smaller rules", () => {
  test("only notices that changed the purchase block checkout", () => {
    assert.equal(noticeBlocksCheckout({ kind: "sold-out", nameUk: "x" }), true);
    assert.equal(noticeBlocksCheckout({ kind: "removed", nameUk: "x" }), true);
    assert.equal(noticeBlocksCheckout({ kind: "reduced", nameUk: "x", requested: 3, available: 1 }), true);
    assert.equal(noticeBlocksCheckout({ kind: "order-released", orderId: "o" }), false);
  });

  test("only staff reach the admin panel", () => {
    assert.equal(isAdminRole("OWNER"), true);
    assert.equal(isAdminRole("MANAGER"), true);
    assert.equal(isAdminRole("CUSTOMER"), false);
    assert.equal(isAdminRole(undefined), false);
  });
});

describe("the size of a banner heading", () => {
  const size = (title: string) => bannerTitleScale(title);
  const LARGE = size("SHORT");
  const MEDIUM = size("A".repeat(50));
  const SMALL = size("A".repeat(90));

  test("three steps, and they differ", () => {
    assert.notEqual(LARGE, MEDIUM);
    assert.notEqual(MEDIUM, SMALL);
  });

  // A heading with no line break is sized by its length alone.
  test("a single-line heading is measured as before — by length", () => {
    assert.equal(size("A".repeat(30)), LARGE);
    assert.equal(size("A".repeat(41)), MEDIUM);
    assert.equal(size("A".repeat(71)), SMALL);
  });

  test("a line break does not shrink a short heading", () => {
    // Sixty characters over three short lines. Width comes from the longest
    // line, and the third line is what adds a step for height.
    const folded = ["A".repeat(20), "A".repeat(20), "A".repeat(20)].join("\n");
    assert.equal(size(folded), MEDIUM);
    // The same text unbroken lands on the same step, but for its length.
    assert.equal(size("A".repeat(62)), MEDIUM);
    // Two such lines take the largest size: short lines, little height.
    assert.equal(size(["A".repeat(20), "A".repeat(20)].join("\n")), LARGE);
  });

  test("a long line stays small however many there are", () => {
    assert.equal(size(["A".repeat(80), "A".repeat(80)].join("\n")), SMALL);
  });

  test("blank lines do not count towards height", () => {
    assert.equal(size(["A".repeat(20), "", "A".repeat(20)].join("\n")), LARGE);
  });

  test("an empty heading does not break the function", () => {
    assert.equal(size("   \n  \n "), LARGE);
  });
});
