/**
 * `applyPayment`, the one function that may write `PAID`.
 *
 * NOTE: (§4.7) Everything about the money a pure test cannot reach: the order of
 * the checks, what happens on a replay, and whether a payment that fails a check
 * leaves a trace a human will see. The comparison itself (`verifyPaidCallback`)
 * is covered without a database in `src/lib/monobank.test.ts`; these tests are
 * about the wiring around it.
 *
 * This is the narrowest place where a mistake costs real money. Read
 * `src/lib/payments.ts` before changing anything here.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  cleanup,
  createFixture,
  disconnect,
  requireExplicitOptIn,
  testPhone,
  UNKNOWN_ORDER_ID,
  type Fixture,
} from "./harness";
import { claimInvoice, createOrder, getOrderById, cancelOrder } from "../../src/lib/db";
import { applyPayment } from "../../src/lib/payments";
import { toKopecks, UAH_CCY } from "../../src/lib/monobank";
import type { OrderCustomer } from "../../src/lib/types";

requireExplicitOptIn();

const PRICE = 500;
let fixture: Fixture;

function customer(n: number): OrderCustomer {
  return {
    firstName: "Test",
    lastName: "Tester",
    phone: testPhone(n),
    email: "dbtest@example.com",
    city: "Kyiv",
    cityRef: "",
    deliveryMethod: "branch",
    branch: "Branch No 1",
    branchRef: "",
    paymentMethod: "mono",
  };
}

/** An order sitting at `PENDING_PAYMENT` with an invoice attached, like a real one. */
async function placedOrder(n: number, quantity = 1) {
  const result = await createOrder(customer(n), [{ productId: fixture.productId, quantity }]);
  assert.ok("order" in result, `the order was not created: ${JSON.stringify(result)}`);

  const invoiceId = `inv-${result.order.id}`;
  assert.equal(await claimInvoice(result.order.id, undefined, invoiceId), true);

  return { id: result.order.id, total: result.order.total, invoiceId };
}

/** A callback exactly as Monobank would send it for that order. */
function goodCallback(order: { id: string; total: number; invoiceId: string }) {
  return {
    reference: order.id,
    invoiceId: order.invoiceId,
    status: "success",
    amount: toKopecks(order.total),
    ccy: UAH_CCY,
  };
}

before(async () => {
  fixture = await createFixture({ stock: 100, price: PRICE });
});

after(async () => {
  await cleanup(fixture);
  await disconnect();
});

describe("a payment is recorded only when everything checks out", () => {
  test("a correct callback marks the order paid", async () => {
    const order = await placedOrder(1);

    const outcome = await applyPayment(order.id, goodCallback(order), "webhook");

    assert.equal(outcome.applied, true);
    const after = await getOrderById(order.id);
    assert.equal(after?.status, "PAID");
    assert.ok(after?.paidAt, "the time of payment has to be stamped");
  });

  test("a replay of the same callback changes nothing", async () => {
    const order = await placedOrder(2);

    const first = await applyPayment(order.id, goodCallback(order), "webhook");
    const second = await applyPayment(order.id, goodCallback(order), "webhook");

    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    // Monobank retries a callback, and a repeat must neither rewrite the time
    // of payment nor fire again what happens once.
    assert.equal((second as { reason: string }).reason, "already paid");

    const after = await getOrderById(order.id);
    assert.equal(after?.status, "PAID");
  });

  test("underpaid — not recorded, and it calls for a human", async () => {
    const order = await placedOrder(3);

    const outcome = await applyPayment(
      order.id,
      { ...goodCallback(order), amount: toKopecks(order.total) - 100 },
      "webhook",
    );

    assert.equal(outcome.applied, false);
    assert.equal((outcome as { review: boolean }).review, true);

    const after = await getOrderById(order.id);
    assert.equal(after?.status, "PENDING_PAYMENT");
    // Only the owner reads the audit log, and a manager works the order — so
    // the discrepancy has to sit on the order itself.
    assert.equal(after?.needsReview, true);
    assert.match(after?.reviewNote ?? "", /did not match/);
  });

  test("paid in another currency — not recorded", async () => {
    const order = await placedOrder(4);

    const outcome = await applyPayment(order.id, { ...goodCallback(order), ccy: 840 }, "webhook");

    assert.equal(outcome.applied, false);
    assert.equal((await getOrderById(order.id))?.status, "PENDING_PAYMENT");
  });

  test("a different invoice was paid — not recorded", async () => {
    const order = await placedOrder(5);

    const outcome = await applyPayment(
      order.id,
      { ...goodCallback(order), invoiceId: "inv-somebody-else" },
      "webhook",
    );

    assert.equal(outcome.applied, false);
    assert.equal((await getOrderById(order.id))?.status, "PENDING_PAYMENT");
  });

  test("a status other than success is not recorded, even for the right amount", async () => {
    const order = await placedOrder(6);

    // `reversed` is a refund. With the right amount it would once have marked
    // the order paid, because the status check lived in the callers rather
    // than here.
    const outcome = await applyPayment(
      order.id,
      { ...goodCallback(order), status: "reversed" },
      "webhook",
    );

    assert.equal(outcome.applied, false);
    assert.equal((await getOrderById(order.id))?.status, "PENDING_PAYMENT");
  });

  test("a payment for an order that does not exist is not lost", async () => {
    const outcome = await applyPayment(
      UNKNOWN_ORDER_ID,
      {
        reference: UNKNOWN_ORDER_ID,
        invoiceId: "inv-nowhere",
        status: "success",
        amount: 50000,
        ccy: UAH_CCY,
      },
      "webhook",
    );

    assert.equal(outcome.applied, false);
    assert.equal((outcome as { reason: string }).reason, "unknown order");
  });

  test("payment lands on a cancelled order — money arrived, goods already back on the shelf", async () => {
    const order = await placedOrder(7);
    assert.ok(await cancelOrder(order.id));

    const outcome = await applyPayment(order.id, goodCallback(order), "webhook");

    assert.equal(outcome.applied, false);
    assert.equal((outcome as { review: boolean }).review, true);

    const after = await getOrderById(order.id);
    assert.equal(after?.status, "CANCELLED");
    assert.equal(after?.needsReview, true);
  });
});
