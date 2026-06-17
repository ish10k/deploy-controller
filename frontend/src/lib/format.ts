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

export function tagSummary(tags: Record<string, string> | null | undefined) {
  const entries = Object.entries(tags ?? {});
  if (!entries.length) {
    return "-";
  }

  return entries
    .map(([key, value]) => `${key}:${value}`)
    .join(", ");
}
