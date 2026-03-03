// src/lib/date-utils.ts
export type BudgetPeriod = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Calculates the strict calendar start and end dates for a given period and reference date.
 * Returns dates in UTC midnight to avoid local timezone shifts during DB insertion.
 */
export function getPeriodBoundaries(period: BudgetPeriod, referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const date = referenceDate.getDate();

  let start: Date;
  let end: Date;

  switch (period) {
    case "daily":
      // Start of current day
      start = new Date(year, month, date, 0, 0, 0, 0);
      // End of current day
      end = new Date(year, month, date, 23, 59, 59, 999);
      break;
    case "weekly":
      // Assuming Monday is the first day of the week
      const day = referenceDate.getDay();
      const diffToMonday = date - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(year, month, diffToMonday, 0, 0, 0, 0);
      end = new Date(year, month, diffToMonday + 6, 23, 59, 59, 999);
      break;
    case "monthly":
      // First day of current month
      start = new Date(year, month, 1, 0, 0, 0, 0);
      // Last day of current month. Day 0 of next month is the last day of current month.
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      break;
    case "yearly":
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      break;
  }

  // Next.js & Postgres pass Dates back and forth, often in UTC.
  // Because Drizzle uses `mode: "date"` for postgres `date` fields, it strips the time completely when querying,
  // but when inserting, timezone shifting can cause e.g., March 1st 00:00 local time to become Feb 28th 17:00 UTC,
  // which Postgres then interprets as Feb 28th.
  // So we explicitly adjust our local bounds by stripping the local offset
  // to ensure 00:00 UTC strictly equals our local start of day.

  const adjustedStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
  const adjustedEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000);

  return { start: adjustedStart, end: adjustedEnd };
}
