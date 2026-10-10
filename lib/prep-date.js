const prepDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatPrepDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return prepDateFormatter.format(date).replaceAll("/", "-");
}
