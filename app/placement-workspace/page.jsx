import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Map,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import { getPlacementProfile } from "@/actions/placement-journey";

export const metadata = {
  title: "Placement Preparation | Nexora AI",
  description: "Access your profile, assessment, preparation plan, and career tools.",
};

const features = [
  {
    title: "Student profile",
    description: "Manage your academic details, skills, interests, and target role.",
    href: "/placement-journey",
    icon: UserRound,
    group: "Your foundation",
  },
  {
    title: "Career assessment",
    description: "Explore your interests and assess aptitude, reasoning, and technical skills.",
    href: "/placement-assessment",
    icon: ClipboardCheck,
    group: "Your foundation",
  },
  {
    title: "Readiness analysis",
    description: "Review your strengths, skill gaps, and role-based readiness.",
    href: "/placement-readiness",
    icon: ChartNoAxesCombined,
    group: "Your preparation",
  },
  {
    title: "Personalized preparation",
    description: "Follow daily learning tasks and practice goals based on your readiness.",
    href: "/placement-preparation",
    icon: BookOpenCheck,
    group: "Your preparation",
  },
  {
    title: "Practice center",
    description: "Practise placement topics with focused, timed, and company-pattern sets.",
    href: "/placement-practice",
    icon: GraduationCap,
    group: "Your preparation",
  },
  {
    title: "Career roadmap",
    description: "Create a learning roadmap for the career direction you choose.",
    href: "/roadmap",
    icon: Map,
    group: "Career tools",
  },
  {
    title: "Learning recommendations",
    description: "Find courses and learning resources aligned with your goals.",
    href: "/course-recommendations",
    icon: BookOpenCheck,
    group: "Career tools",
  },
  {
    title: "Interview practice",
    description: "Prepare for interviews and review your practice performance.",
    href: "/interview",
    icon: MessageSquareText,
    group: "Career tools",
  },
  {
    title: "Resume tools",
    description: "Build and improve a resume that reflects your skills and projects.",
    href: "/resume-builder",
    icon: FileText,
    group: "Career tools",
  },
  {
    title: "Job and company tools",
    description: "Explore companies and find opportunities that suit your career goals.",
    href: "/company-explorer",
    icon: BriefcaseBusiness,
    group: "Career tools",
  },
];

export default async function PlacementWorkspacePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { journey } = await getPlacementProfile();
  const hasProfile = Boolean(journey?.profile?.profileCompleted);
  const groups = [...new Set(features.map((feature) => feature.group))];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Placement preparation</p>
        <h1 className="gradient-title text-4xl font-bold md:text-5xl">Your preparation workspace</h1>
        <p className="mt-4 text-muted-foreground">
          Build your profile, understand your readiness, and move through focused preparation and career tools.
        </p>
        {!hasProfile && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="font-medium">Start by setting up your placement profile.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your profile will use the email address associated with your Nexora sign-in.
            </p>
            <Link className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary" href="/placement-journey">
              Set up profile <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </header>

      {groups.map((group) => (
        <section className="mb-10" key={group}>
          <h2 className="mb-4 text-xl font-semibold">{group}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.filter((feature) => feature.group === group).map(({ title, description, href: featureHref, icon: Icon }) => {
              const href = featureHref === "/placement-journey" && hasProfile
                ? "/placement-journey?edit=true"
                : featureHref;
              return (
              <Link
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
                href={href}
                key={featureHref}
              >
                <Icon className="mb-4 text-primary" size={22} />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 min-h-12 text-sm text-muted-foreground">{description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} />
                </span>
              </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
