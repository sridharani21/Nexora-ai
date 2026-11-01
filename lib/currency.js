const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function usdToInrRate() {
  const rate = Number(process.env.NEXT_PUBLIC_USD_TO_INR_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convertAmountToInr(amount, currency = "INR") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const normalizedCurrency = String(currency).trim().toUpperCase();
  if (normalizedCurrency === "INR" || normalizedCurrency === "₹") return value;
  if (normalizedCurrency !== "USD" && normalizedCurrency !== "US$" && normalizedCurrency !== "$") return null;
  const rate = usdToInrRate();
  return rate === null ? null : value * rate;
}

export function formatInrAmount(amount) {
  return Number.isFinite(amount) ? inrFormatter.format(amount) : "INR amount unavailable";
}

export function formatCoursePriceInr(price) {
  const text = String(price ?? "").trim();
  if (!text) return "INR price unavailable";
  if (Number(price) === 0) return "Free";
  const amountText = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!amountText) return "INR price unavailable";
  const amount = Number(amountText[0].replace(/,/g, ""));
  if (/[€£]|\b(?:EUR|GBP|AUD|CAD)\b/i.test(text)) return "INR conversion rate unavailable";
  const currency = /₹|\bINR\b/i.test(text) ? "INR" : "USD";
  const converted = convertAmountToInr(amount, currency);
  return converted === null ? "INR conversion rate unavailable" : formatInrAmount(converted);
}

export function formatSalaryRangeInr(salaryRange) {
  const text = String(salaryRange ?? "").trim();
  if (!text) return "";
  if (/[€£]|\b(?:EUR|GBP|AUD|CAD)\b/i.test(text)) return "INR estimate unavailable";
  const hasUsd = /US\$|\bUSD\b|\$/i.test(text);
  if (!hasUsd) return /₹|\bINR\b/i.test(text) ? text : "INR estimate unavailable";
  const rate = usdToInrRate();
  if (rate === null) return "INR estimate unavailable";
  const converted = text.replace(
    /(?:US\$|\bUSD\s*|\$)\s*([\d,]+(?:\.\d+)?)(\s*[kKmM])?/gi,
    (_match, amountText, unit = "") => {
      const multiplier = /m/i.test(unit) ? 1_000_000 : /k/i.test(unit) ? 1_000 : 1;
      return formatInrAmount(Number(amountText.replace(/,/g, "")) * multiplier * rate);
    },
  );
  return /\$|\bUSD\b/i.test(converted) ? "INR estimate unavailable" : converted;
}
