import "dotenv/config";
import { runGeminiDiagnostic } from "../../lib/module4/gemini-diagnostic.js";

const result = await runGeminiDiagnostic();
if (result.success) {
  console.log("Gemini diagnostic: success (provider returned the validated response).");
} else if (result.category === "quota_exhausted") {
  console.log("Gemini diagnostic: project quota or billing limit reached. Check the Gemini API project's usage and billing.");
} else {
  console.log(`Gemini diagnostic: blocked (${result.category}).`);
  process.exitCode = 1;
}
