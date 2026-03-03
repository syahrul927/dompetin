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
      start = new Date(year, month, date, 0, 0, 0, 0);
      end = new Date(year, month, date, 23, 59, 59, 999);
      break;
    case "weekly":
      // Assuming Monday is the first day of the week
      const day = referenceDate.getDay();
      const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(year, month, diff, 0, 0, 0, 0);
      end = new Date(year, month, diff + 6, 23, 59, 59, 999);
      break;
    case "monthly":
      start = new Date(year, month, 1, 0, 0, 0, 0);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      break;
    case "yearly":
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      break;
  }

  return { start, end };
}
