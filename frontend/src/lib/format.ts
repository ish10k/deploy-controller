export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type RelativeTimeOptions = {
  mode?: "long" | "short";
  now?: Date;
};

export function formatRelativeTime(value: string | null | undefined, optionsOrNow: RelativeTimeOptions | Date = {}) {
  if (!value) {
    return "-";
  }

  const options = optionsOrNow instanceof Date ? { now: optionsOrNow } : optionsOrNow;
  const now = options.now ?? new Date();
  const mode = options.mode ?? "long";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);
  if (absoluteSeconds < 45) {
    return mode === "short" ? "now" : "just now";
  }

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 60 * 60],
    ["day", 60 * 60 * 24],
    ["week", 60 * 60 * 24 * 7],
    ["month", 60 * 60 * 24 * 30],
    ["year", 60 * 60 * 24 * 365],
  ];
  const [unit, secondsPerUnit] =
    thresholds.find(([, secondsPerUnit], index) => absoluteSeconds < (thresholds[index + 1]?.[1] ?? Number.POSITIVE_INFINITY)) ??
    thresholds[thresholds.length - 1];
  const valueInUnits = Math.round(diffSeconds / secondsPerUnit);

  if (mode === "short") {
    const shortUnits: Record<string, string> = {
      second: "s",
      seconds: "s",
      minute: "m",
      minutes: "m",
      hour: "h",
      hours: "h",
      day: "d",
      days: "d",
      week: "w",
      weeks: "w",
      month: "mo",
      months: "mo",
      quarter: "q",
      quarters: "q",
      year: "y",
      years: "y",
    };
    const value = Math.abs(valueInUnits);
    const label = `${value}${shortUnits[unit]}`;
    return diffSeconds > 0 ? `in ${label}` : `${label} ago`;
  }

  return new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(valueInUnits, unit);
}

export function tagSummary(tags: Record<string, string> | null | undefined) {
  const entries = Object.entries(tags ?? {});
  if (!entries.length) {
    return "-";
  }

  return entries
    .map(([key, value]) => `${key}:${value}`)
    .join(", ");
}

