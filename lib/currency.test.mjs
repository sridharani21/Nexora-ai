import test from "node:test";
import assert from "node:assert/strict";
import {
  convertAmountToInr,
  formatCoursePriceInr,
  formatInrAmount,
  formatSalaryRangeInr,
} from "./currency.js";

test("INR formatting preserves rupee amounts and converts USD using configured rate", () => {
  process.env.NEXT_PUBLIC_USD_TO_INR_RATE = "83.5";
  assert.equal(convertAmountToInr(100, "INR"), 100);
  assert.equal(convertAmountToInr(10, "USD"), 835);
  assert.equal(formatInrAmount(123456), "₹1,23,456");
  assert.equal(formatCoursePriceInr("$20 USD"), "₹1,670");
  assert.equal(formatCoursePriceInr("₹2,499"), "₹2,499");
  assert.equal(formatCoursePriceInr(0), "Free");
  assert.equal(formatSalaryRangeInr("$40,000 - $60,000"), "₹33,40,000 - ₹50,10,000");
  assert.equal(formatSalaryRangeInr("USD 40k - ₹50 LPA"), "₹33,40,000 - ₹50 LPA");
});

test("unsupported currencies and missing USD rate never display a misleading dollar value", () => {
  delete process.env.NEXT_PUBLIC_USD_TO_INR_RATE;
  assert.equal(convertAmountToInr(10, "EUR"), null);
  assert.equal(formatCoursePriceInr("$10"), "INR conversion rate unavailable");
  assert.equal(formatSalaryRangeInr("USD 50,000"), "INR estimate unavailable");
});
