import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCareerDiscovery } from "@/actions/career-discovery";
import CareerDiscoveryWizard from "./_components/career-discovery-wizard";

export const metadata = {
  title: "Career Discovery & Learning | Nexora AI",
  description: "Profile, career matches, skill gaps, roadmap, courses, and a weekly learning plan.",
};

export default async function CareerDiscoveryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { journey, defaults } = await getCareerDiscovery();

  return (
    <div className="px-4 sm:px-5">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold gradient-title">
          Career Discovery & Learning
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-1">
          Follow the path: profile → careers → skill gaps → roadmap → courses → weekly plan.
        </p>
      </div>
      <CareerDiscoveryWizard initialJourney={journey} defaults={defaults} />
    </div>
  );
}
