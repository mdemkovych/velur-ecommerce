/**
 * Timezone-aware date boundary calculations for order statistics in Europe/Kyiv.
 *
 * NOTE: (§8.4) Calculates midnight boundaries strictly in Kyiv timezone to avoid UTC offset discrepancies on hosting platforms.
 */

const KYIV_TIME_ZONE = "Europe/Kyiv";

export const STAT_PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
] as const;

export type StatPeriod = (typeof STAT_PERIODS)[number]["id"];

export const DEFAULT_STAT_PERIOD: StatPeriod = "all";

export function isStatPeriod(value: string): value is StatPeriod {
  return STAT_PERIODS.some((period) => period.id === value);
}

// Enforces 24-hour cycle ("h23") so midnight formats as 00:00 instead of 12:00.
const KYIV_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: KYIV_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function kyivParts(at: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = KYIV_PARTS.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Positive while the Kyiv wall clock is ahead of UTC, which it always is. */
function kyivOffsetMs(at: Date): number {
  const { year, month, day, hour, minute, second } = kyivParts(at);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return wallAsUtc - (at.getTime() - at.getUTCMilliseconds());
}

function kyivMidnight(year: number, month: number, day: number): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day);
  const firstGuess = new Date(wallAsUtc - kyivOffsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - kyivOffsetMs(firstGuess));
}

/**
 * Calculates start Date timestamp in Europe/Kyiv for the given statistical period.
 *
 * @param period Identifier ('today', 'week', 'month', 'year', 'all').
 * @param now Current reference timestamp.
 * @returns Date object representing the period start in UTC, or null for 'all'.
 */
export function periodStart(period: Exclude<StatPeriod, "all">, now: Date): Date;
export function periodStart(period: StatPeriod, now: Date): Date | null;
export function periodStart(period: StatPeriod, now: Date): Date | null {
  if (period === "all") return null;

  const { year, month, day } = kyivParts(now);
  switch (period) {
    case "today":
      return kyivMidnight(year, month, day);
    case "week": {
      // Built in UTC so no zone enters the weekday, and shifted because
      // `getUTCDay()` counts Sunday as 0.
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      return kyivMidnight(year, month, day - ((weekday + 6) % 7));
    }
    case "month":
      return kyivMidnight(year, month, 1);
    case "year":
      return kyivMidnight(year, 1, 1);
  }
}
