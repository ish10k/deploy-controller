import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  it("formats recent timestamps as just now", () => {
    expect(formatRelativeTime("2026-06-18T11:59:30.000Z", now)).toBe("just now");
  });

  it("formats past timestamps using the largest useful unit", () => {
    expect(formatRelativeTime("2026-06-18T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-06-18T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-06-15T12:00:00.000Z", now)).toBe("3 days ago");
  });

  it("keeps empty and invalid values stable", () => {
    expect(formatRelativeTime(null, now)).toBe("-");
    expect(formatRelativeTime("not-a-date", now)).toBe("not-a-date");
  });

  it("formats compact timestamps with short units", () => {
    expect(formatRelativeTime("2026-06-18T11:59:30.000Z", { mode: "short", now })).toBe("now");
    expect(formatRelativeTime("2026-06-18T11:55:00.000Z", { mode: "short", now })).toBe("5m ago");
    expect(formatRelativeTime("2026-06-18T09:00:00.000Z", { mode: "short", now })).toBe("3h ago");
    expect(formatRelativeTime("2026-06-15T12:00:00.000Z", { mode: "short", now })).toBe("3d ago");
    expect(formatRelativeTime("2026-06-18T12:05:00.000Z", { mode: "short", now })).toBe("in 5m");
  });
});

