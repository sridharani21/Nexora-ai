import ATSScanner from "./_components/ats-scanner";

export const metadata = {
  title: "ATS Resume Scanner | Nexora AI",
  description: "Score your resume for ATS readiness and get targeted improvements.",
};

export default function ATSScannerPage() {
  return (
    <div className="px-4 sm:px-5">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Resume & Job Modules
        </p>
        <h1 className="gradient-title text-4xl font-bold sm:text-5xl">
          ATS Resume Scanner
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Upload a PDF to check its ATS readiness, identify gaps, and improve
          alignment with a target role.
        </p>
      </div>
      <ATSScanner />
    </div>
  );
}
