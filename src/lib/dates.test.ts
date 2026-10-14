import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  businessCurrentMonth,
  businessCurrentWeekStart,
  businessToday,
  compareDateStrings,
  dateOnlySchema,
  daysBetween,
  daysInMonth,
  daysInWeek,
  formatInBusinessTimeZone,
  monthStartDate,
  shiftMonth,
  shiftWeek,
  weekStartDate,
} from "./dates";

describe("dateOnlySchema", () => {
  it("accepts a well-formed date", () => {
    expect(dateOnlySchema.parse("2026-10-08")).toBe("2026-10-08");
  });

  it("rejects anything else", () => {
    expect(() => dateOnlySchema.parse("10/08/2026")).toThrow();
    expect(() => dateOnlySchema.parse("2026-10-08T00:00:00Z")).toThrow();
  });
});

describe("monthStartDate", () => {
  it("returns the first day of the month", () => {
    expect(monthStartDate("2026-10")).toBe("2026-10-01");
  });
});

describe("daysInMonth", () => {
  it("lists every date in a 31-day month", () => {
    const days = daysInMonth("2026-10");
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-10-01");
    expect(days.at(-1)).toBe("2026-10-31");
  });

  it("handles February in a leap year", () => {
    expect(daysInMonth("2028-02")).toHaveLength(29);
  });
});

describe("shiftMonth", () => {
  it("rolls over into the next year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("businessCurrentMonth", () => {
  it("derives the month from businessToday", () => {
    const now = new Date("2026-10-08T22:30:00Z");
    expect(businessCurrentMonth("Europe/Kyiv", now)).toBe("2026-10");
  });
});

describe("businessToday", () => {
  it("uses the business time zone, not UTC", () => {
    // 2026-10-08 22:30 UTC is already 2026-10-09 past midnight in Kyiv (UTC+3 in October).
    const instant = new Date("2026-10-08T22:30:00Z");
    expect(businessToday("Europe/Kyiv", instant)).toBe("2026-10-09");
    expect(businessToday("UTC", instant)).toBe("2026-10-08");
  });

  it("stays on the same day for a time zone behind UTC", () => {
    const instant = new Date("2026-10-09T02:00:00Z");
    expect(businessToday("America/New_York", instant)).toBe("2026-10-08");
  });
});

describe("addDaysToDateString", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysToDateString("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("adds days across a year boundary", () => {
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("subtracts days with a negative count", () => {
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by DST transitions, unlike local-time arithmetic", () => {
    // Europe/Kyiv moves clocks back at the end of October.
    expect(addDaysToDateString("2026-10-24", 7)).toBe("2026-10-31");
  });
});

describe("compareDateStrings", () => {
  it("orders dates lexicographically", () => {
    expect(compareDateStrings("2026-10-08", "2026-10-09")).toBe(-1);
    expect(compareDateStrings("2026-10-09", "2026-10-08")).toBe(1);
    expect(compareDateStrings("2026-10-08", "2026-10-08")).toBe(0);
  });
});

describe("daysBetween", () => {
  it("counts whole days forward and backward", () => {
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
    expect(daysBetween("2026-10-08", "2026-10-08")).toBe(0);
  });
});

describe("weekStartDate", () => {
  it("returns the same date when it is already a Monday", () => {
    expect(weekStartDate("2026-10-12")).toBe("2026-10-12");
  });

  it("rolls back to Monday for a mid-week date", () => {
    expect(weekStartDate("2026-10-15")).toBe("2026-10-12");
  });

  it("rolls back to Monday for a Sunday", () => {
    expect(weekStartDate("2026-10-18")).toBe("2026-10-12");
  });
});

describe("daysInWeek", () => {
  it("lists seven consecutive days starting Monday", () => {
    const days = daysInWeek("2026-10-12");
    expect(days).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });
});

describe("shiftWeek", () => {
  it("moves forward and backward by whole weeks", () => {
    expect(shiftWeek("2026-10-12", 1)).toBe("2026-10-19");
    expect(shiftWeek("2026-10-12", -1)).toBe("2026-10-05");
  });
});

describe("businessCurrentWeekStart", () => {
  it("derives the Monday of the current week in the business time zone", () => {
    // 2026-10-08 22:30 UTC is 2026-10-09 (Friday) in Kyiv; that week starts Monday 2026-10-05.
    const now = new Date("2026-10-08T22:30:00Z");
    expect(businessCurrentWeekStart("Europe/Kyiv", now)).toBe("2026-10-05");
  });
});

describe("formatInBusinessTimeZone", () => {
  it("renders the instant in the given time zone and locale", () => {
    const instant = new Date("2026-10-08T22:30:00Z");
    const formatted = formatInBusinessTimeZone(
      instant,
      "Europe/Kyiv",
      "en-GB",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );
    expect(formatted).toBe("09/10/2026");
  });
});
