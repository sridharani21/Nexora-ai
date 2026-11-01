import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Mic2,
  Sparkles,
  UserRound,
} from "lucide-react";

export const metadata = {
  title: "Student Dashboard | Nexora AI",
  description: "Access your six guided student career and preparation modules.",
};

const modules = [
  {
    number: "01",
    title: "Student Profile",
    description: "Add your academic background, skills, projects, and career preferences.",
    href: "/student-profile",
    action: "Review your profile",
    category: "Your foundation",
    Icon: UserRound,
    iconStyle: "bg-indigo-50 text-indigo-700",
    accent: "group-hover:border-indigo-200",
  },
  {
    number: "02",
    title: "Technical Assessment",
    description: "Take a branch-specific assessment and review your readiness results.",
    href: "/assessment",
    action: "Open assessment",
    category: "Measure your skills",
    Icon: ClipboardCheck,
    iconStyle: "bg-cyan-50 text-cyan-700",
    accent: "group-hover:border-cyan-200",
  },
  {
    number: "03",
    title: "Career Interests",
    description: "Explore six RIASEC interest areas with a self-paced reflection.",
    href: "/career-interests",
    action: "Explore interests",
    category: "Understand what you enjoy",
    Icon: Compass,
    iconStyle: "bg-violet-50 text-violet-700",
    accent: "group-hover:border-violet-200",
  },
  {
    number: "04",
    title: "Career Recommendation",
    description: "Explore career options using your goals, experience, and interests.",
    href: "/career-explorer",
    action: "Explore careers",
    category: "Find possible directions",
    Icon: BriefcaseBusiness,
    iconStyle: "bg-amber-50 text-amber-700",
    accent: "group-hover:border-amber-200",
  },
  {
    number: "05",
    title: "Skill Development",
    description: "Build practical skills with learning resources and focused practice.",
    href: "/skill-development/setup",
    action: "Build your skills",
    category: "Plan your next steps",
    Icon: BookOpenCheck,
    iconStyle: "bg-emerald-50 text-emerald-700",
    accent: "group-hover:border-emerald-200",
  },
  {
    number: "06",
    title: "AI Mock Interview",
    description: "Prepare for interviews with practice tailored to your chosen role.",
    href: "/mock-interview",
    action: "Practice an interview",
    category: "Get interview-ready",
    Icon: Mic2,
    iconStyle: "bg-rose-50 text-rose-700",
    accent: "group-hover:border-rose-200",
  },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName?.trim();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-4 py-7 sm:px-6 lg:space-y-12 lg:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <GraduationCap className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-950">Nexora student space</p>
            <p className="text-xs text-slate-500">Your learning and career journey</p>
          </div>
        </div>
        <Link
          href="/student-profile"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <UserRound className="size-4" aria-hidden="true" />
          Profile
        </Link>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-9 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-12 lg:px-14">
        <div className="pointer-events-none absolute -right-20 -top-36 size-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 size-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-100">
              <Sparkles className="size-3.5" aria-hidden="true" />
              YOUR PERSONAL LEARNING HUB
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {firstName ? `Welcome back, ${firstName}.` : "Your next step starts here."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Choose a module to build your profile, discover opportunities, strengthen your skills, and prepare for interviews—all in one place.
            </p>
          </div>
          <Link
            href="/student-profile"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:self-auto"
          >
            Continue your journey
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-5 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-300" aria-hidden="true" /> Six connected modules</span>
          <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-300" aria-hidden="true" /> Progress at your pace</span>
          <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-300" aria-hidden="true" /> One personal workspace</span>
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Your workspace</p>
            <h2 id="modules-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Explore your six modules</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">Start wherever you need. Your profile and results help personalize the modules you choose.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ number, title, description, href, action, category, Icon, iconStyle, accent }) => (
            <Link
              key={number}
              href={href}
              className={`group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${accent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-11 items-center justify-center rounded-xl ${iconStyle}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-sm font-semibold tracking-wide text-slate-300">{number}</span>
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{category}</p>
              <h3 className="mt-1.5 text-lg font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-indigo-700">
                {action}
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm leading-6 text-slate-700">
          <span className="font-semibold text-slate-950">Not sure where to start?</span> Add or update your profile first; it helps personalize recommendations and interview practice.
        </p>
        <Link href="/student-profile" className="mt-3 inline-flex shrink-0 items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-900 sm:mt-0">
          Open profile <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </footer>
    </main>
  );
}
