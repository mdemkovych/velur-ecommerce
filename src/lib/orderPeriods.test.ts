import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isStatPeriod, periodStart, STAT_PERIODS } from "./orderPeriods";

/** Every boundary is asserted as a UTC instant, which is what the query gets. */
const utc = (at: Date) => at.toISOString();

describe("period boundaries are computed in Kyiv time", () => {
  test("«Today» starts at Kyiv midnight, not at UTC midnight", () => {
    // In summer Kyiv is +3, so the day begins at 21:00 UTC the day before.
    assert.equal(
      utc(periodStart("today", new Date("2026-08-22T10:00:00Z"))),
      "2026-08-21T21:00:00.000Z",
    );
    // In winter, +2.
    assert.equal(
      utc(periodStart("today", new Date("2026-01-15T10:00:00Z"))),
      "2026-01-14T22:00:00.000Z",
    );
  });

  test("a late Kyiv evening belongs to its own day, not the previous one", () => {
    /*
      * The very mistake this file exists for. At 22:30 UTC it is already 01:30
      * of the next day in Kyiv, and a server in Dublin counting the day by its
      * own clock would return a boundary of 2026-08-22T00:00Z, counting an
      * order placed in the small hours of the 23rd as yesterday's.
      */
    assert.equal(
      utc(periodStart("today", new Date("2026-08-22T22:30:00Z"))),
      "2026-08-22T21:00:00.000Z",
    );
  });

  test("a week starts on Monday", () => {
    // 22.08.2026 is a Saturday; the Monday of that week is 17.08.
    assert.equal(
      utc(periodStart("week", new Date("2026-08-22T10:00:00Z"))),
      "2026-08-16T21:00:00.000Z",
    );
    // Sunday belongs to the week that started on the Monday before it.
    assert.equal(
      utc(periodStart("week", new Date("2026-08-23T10:00:00Z"))),
      "2026-08-16T21:00:00.000Z",
    );
    // A Monday is the start of its own week.
    assert.equal(
      utc(periodStart("week", new Date("2026-08-17T10:00:00Z"))),
      "2026-08-16T21:00:00.000Z",
    );
  });

  test("a week can start in the previous month", () => {
    // 02.09.2026 is a Wednesday; that week's Monday is 31.08. Which is why the
    // week and month boundaries are computed separately, not one from the other.
    const week = periodStart("week", new Date("2026-09-02T10:00:00Z"));
    const month = periodStart("month", new Date("2026-09-02T10:00:00Z"));
    assert.equal(utc(week), "2026-08-30T21:00:00.000Z");
    assert.equal(utc(month), "2026-08-31T21:00:00.000Z");
    assert.ok(week < month, "the week starts before the month does");
  });

  test("month and year are Kyiv midnight too", () => {
    assert.equal(
      utc(periodStart("month", new Date("2026-08-22T10:00:00Z"))),
      "2026-07-31T21:00:00.000Z",
    );
    assert.equal(
      utc(periodStart("year", new Date("2026-08-22T10:00:00Z"))),
      "2025-12-31T22:00:00.000Z",
    );
  });

  test("the day does not slip an hour on the nights the clocks move", () => {
    /*
      * On 29.03.2026 Kyiv goes from +2 to +3 at 03:00. At midnight that day the
      * offset is still +2, so the day begins at 22:00 UTC on the 28th, and a
      * query made in the afternoon, when the offset is already +3, must return
      * that same boundary rather than one taken from the time of the request.
      */
    assert.equal(
      utc(periodStart("today", new Date("2026-03-29T12:00:00Z"))),
      "2026-03-28T22:00:00.000Z",
    );
    // On 25.10.2026 the clocks go back, +3 to +2 at 04:00: midnight is still +3.
    assert.equal(
      utc(periodStart("today", new Date("2026-10-25T12:00:00Z"))),
      "2026-10-24T21:00:00.000Z",
    );
  });

  test("«All time» has no boundary", () => {
    assert.equal(periodStart("all", new Date("2026-08-22T10:00:00Z")), null);
  });

  test("every period but «All time» yields a boundary in the past", () => {
    const now = new Date("2026-08-22T10:00:00Z");
    for (const period of STAT_PERIODS) {
      const start = periodStart(period.id, now);
      if (period.id === "all") continue;
      assert.ok(start !== null && start <= now, `${period.id} must start in the past`);
    }
  });
});

describe("parsing the period out of a request", () => {
  test("only known values are accepted", () => {
    assert.equal(isStatPeriod("week"), true);
    assert.equal(isStatPeriod("all"), true);
    assert.equal(isStatPeriod("decade"), false);
    assert.equal(isStatPeriod(""), false);
  });
});
