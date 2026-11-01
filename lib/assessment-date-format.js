function indiaDateParts(value) {
  const date = new Date(new Date(value).getTime() + 330 * 60_000);
  return {
    day: String(date.getUTCDate()).padStart(2, "0"),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    year: String(date.getUTCFullYear()),
    hour: date.getUTCHours() % 12 || 12,
    minute: String(date.getUTCMinutes()).padStart(2, "0"),
    second: String(date.getUTCSeconds()).padStart(2, "0"),
    period: date.getUTCHours() >= 12 ? "pm" : "am",
  };
}

export function formatAssessmentDateTime(value) {
  const parts = indiaDateParts(value);
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${parts.period}`;
}

export function formatAssessmentTime(value) {
  const parts = indiaDateParts(value);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}
