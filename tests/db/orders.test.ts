/**
 * `createOrder`: reserving stock, refusing duplicates, and who decides the price.
 *
 * NOTE: (§3.5, §4.2, §4.3) The conditional update at the heart of it
 * (`stock >= quantity` inside the WHERE clause) is what stands between two
 * shoppers and the same last unit, and none of it can be exercised without a
 * database.
 *
 * There is deliberately no concurrency test. Proving the race is closed means
 * two transactions interleaved at a chosen instant on two connections driven in
 * lockstep. A test that fires two promises and finds no clash has proved nothing
 * about the lock, and reads as though it had.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  cleanup,
  createFixture,
  disconnect,
  requireExplicitOptIn,
  stockOf,
  testPhone,
  type Fixture,
} from "./harness";
import { createOrder } from "../../src/lib/db";
import type { OrderCustomer } from "../../src/lib/types";

requireExplicitOptIn();

const PRICE = 500;
const PROMO = 400;
const START_STOCK = 50;

let fixture: Fixture;

function customer(n: number): OrderCustomer {
  return {
    firstName: "Test",
    lastName: "Tester",
    phone: testPhone(100 + n),
    email: "dbtest@example.com",
    city: "Kyiv",
    cityRef: "",
    deliveryMethod: "branch",
    branch: "Branch No 1",
    branchRef: "",
    paymentMethod: "mono",
  };
}

before(async () => {
  // The promotional price is set deliberately: that is what the customer pays,
  // and the easiest way to miss it is to test on a product without one.
  fixture = await createFixture({ stock: START_STOCK, price: PRICE, promotionalPrice: PROMO });
});

after(async () => {
  await cleanup(fixture);
  await disconnect();
});

describe("an order reserves the goods and computes the money itself", () => {
  test("creating an order takes exactly the quantity ordered", async () => {
    const before = await stockOf(fixture.productId);

    const result = await createOrder(customer(1), [{ productId: fixture.productId, quantity: 3 }]);

    assert.ok("order" in result, "the order should have been created");
    assert.equal(await stockOf(fixture.productId), before - 3);
  });

  test("the server computes the total, and at the promotional price", async () => {
    const result = await createOrder(customer(2), [{ productId: fixture.productId, quantity: 2 }]);

    assert.ok("order" in result);
    // `chargedPrice()` is the promotional one when there is one. Reading
    // `product.price` here would give 1000 instead of 800, and the customer
    // would see one figure in the basket and be charged another.
    assert.equal(result.order.total, PROMO * 2);
    assert.equal(result.order.items[0].price, PROMO);
  });

  test("more than the shelf holds does not sell, and stock does not move", async () => {
    const before = await stockOf(fixture.productId);

    const result = await createOrder(customer(3), [
      { productId: fixture.productId, quantity: START_STOCK + 1 },
    ]);

    assert.ok("error" in result, "it should have refused");
    assert.match(result.error, /are left|sold out/);
    // The whole transaction rolls back, so not one unit may go missing.
    assert.equal(await stockOf(fixture.productId), before);
  });

  test("the same basket from the same number is the same order, not a second one", async () => {
    const person = customer(4);
    const lines = [{ productId: fixture.productId, quantity: 2 }];

    const before = await stockOf(fixture.productId);
    const first = await createOrder(person, lines);
    const afterFirst = await stockOf(fixture.productId);
    const second = await createOrder(person, lines);

    assert.ok("order" in first && "order" in second);
    // A double click, a retry after a dropped connection, a second tab — that
    // is one purchase. Otherwise each of them would reserve its own goods.
    assert.equal(second.order.id, first.order.id);
    assert.equal(afterFirst, before - 2);
    assert.equal(await stockOf(fixture.productId), before - 2);
  });

  test("a different basket from the same number is a new order", async () => {
    const person = customer(5);

    const first = await createOrder(person, [{ productId: fixture.productId, quantity: 1 }]);
    const second = await createOrder(person, [{ productId: fixture.productId, quantity: 2 }]);

    assert.ok("order" in first && "order" in second);
    assert.notEqual(second.order.id, first.order.id);
  });

  test("a fourth unpaid order from one number is refused", async () => {
    const person = customer(6);

    // The quantities differ; otherwise the deduplication above kicks in and
    // there is no fourth order to refuse.
    for (const quantity of [1, 2, 3]) {
      const ok = await createOrder(person, [{ productId: fixture.productId, quantity }]);
      assert.ok("order" in ok, `the order for ${quantity} should have been created`);
    }

    const stockBefore = await stockOf(fixture.productId);
    const fourth = await createOrder(person, [{ productId: fixture.productId, quantity: 4 }]);

    assert.ok("error" in fourth, "the fourth should have been refused");
    assert.match(fourth.error, /awaiting payment/);
    // The important part of this test: a refusal must reserve nothing.
    assert.equal(await stockOf(fixture.productId), stockBefore);
  });

  test("a product that does not exist creates no order", async () => {
    const result = await createOrder(customer(7), [
      { productId: "no-such-product-id", quantity: 1 },
    ]);

    assert.ok("error" in result);
    assert.match(result.error, /no longer available/);
  });
});
