import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  businessCurrentMonth,
  businessToday,
  compareDateStrings,
  dateOnlySchema,
  daysBetween,
  daysInMonth,
  formatInBusinessTimeZone,
  monthStartDate,
  shiftMonth,
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
