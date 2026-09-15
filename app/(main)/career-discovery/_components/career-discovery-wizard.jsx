"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  saveCareerProfile,
  generateCareerRecommendations,
  selectCareerAndAnalyzeGaps,
  generateDiscoveryRoadmap,
  generateDiscoveryCourses,
  generateLearningPlan,
  toggleLearningTask,
  setDiscoveryStep,
} from "@/actions/career-discovery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  Compass,
  Loader2,
  Map,
  ScanSearch,
  Target,
  UserRound,
} from "lucide-react";

const STEPS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "careers", label: "Careers", icon: Target },
  { id: "skillgap", label: "Skill Gap", icon: ScanSearch },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "planner", label: "Planner", icon: Calendar },
];

function csv(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

export default function CareerDiscoveryWizard({ initialJourney, defaults }) {
  const [journey, setJourney] = useState(initialJourney);
  const [step, setStep] = useState(initialJourney?.currentStep || "profile");
  const [loading, setLoading] = useState(false);

  const [education, setEducation] = useState(initialJourney?.education || "");
  const [experienceYears, setExperienceYears] = useState(
    initialJourney?.experienceYears ?? defaults?.experience ?? 0
  );
  const [currentRole, setCurrentRole] = useState(initialJourney?.currentRole || "");
  const [skills, setSkills] = useState(csv(initialJourney?.skills) || csv(defaults?.skills));
  const [interests, setInterests] = useState(csv(initialJourney?.interests));
  const [location, setLocation] = useState(initialJourney?.location || "");
  const [careerGoal, setCareerGoal] = useState(initialJourney?.careerGoal || "");

  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canOpen = useMemo(() => {
    const j = journey || {};
    return {
      profile: true,
      careers: Boolean(j.skills?.length),
      skillgap: Boolean(j.selectedCareer),
      roadmap: Boolean(j.skillGap),
      courses: Boolean(j.roadmap),
      planner: Boolean(j.courses),
    };
  }, [journey]);

  const run = async (fn, nextStep) => {
    setLoading(true);
    try {
      const result = await fn();
      if (result) setJourney(result);
      if (nextStep) {
        setStep(nextStep);
        await setDiscoveryStep(nextStep);
      }
    } catch (e) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const goTo = (id) => {
    if (!canOpen[id] && id !== "profile") {
      toast.error("Complete the previous step first.");
      return;
    }
    setStep(id);
  };

  const careers = journey?.careerRecommendations?.careers || [];
  const missing = journey?.skillGap?.missing || [];
  const have = journey?.skillGap?.have || [];
  const phases = journey?.roadmap?.phases || [];
  const courses = journey?.courses?.items || [];
  const weeks = journey?.learningPlan?.weeks || [];
  const totalTasks = weeks.reduce((n, w) => n + (w.tasks?.length || 0), 0);
  const doneTasks = weeks.reduce((n, w) => n + (w.tasks?.filter((t) => t.done).length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Progress value={progress} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors",
                  active && "border-primary bg-primary/10 text-foreground",
                  done && !active && "border-primary/40 text-foreground",
                  !active && !done && "border-border text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {step === "profile" && (
        <Card className="border">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserRound className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">User Profile</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Tell us about you so we can recommend careers that actually fit.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  placeholder="e.g. B.Tech Computer Science, 2025"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Years of experience</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  max="50"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Current / last role</Label>
                <Input
                  id="role"
                  placeholder="Student, Intern, Junior Developer…"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Input
                  id="skills"
                  placeholder="Python, JavaScript, SQL, Communication"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="interests">Interests (comma separated)</Label>
                <Input
                  id="interests"
                  placeholder="AI, product design, fintech"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City / remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="goal">Career goal</Label>
                <Textarea
                  id="goal"
                  placeholder="What do you want to become in 1–3 years?"
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full sm:w-auto ml-auto"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await saveCareerProfile({
                    education,
                    experienceYears,
                    currentRole,
                    skills,
                    interests,
                    location,
                    careerGoal,
                  });
                  const rec = await generateCareerRecommendations();
                  setJourney(rec);
                  setStep("careers");
                } catch (e) {
                  toast.error(e.message || "Something went wrong.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & find careers"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "careers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Career Recommendation
              </h2>
              <p className="text-sm text-muted-foreground">Pick the role you want to pursue next.</p>
            </div>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => run(generateCareerRecommendations, "careers")}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate recommendations"}
            </Button>
          </div>
          {careers.length === 0 ? (
            <Card className="border">
              <CardContent className="py-10 text-center text-muted-foreground">
                Save your profile, then generate career matches.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {careers.map((c) => (
                <Card
                  key={c.title}
                  className={cn(
                    "border flex flex-col py-0 gap-0",
                    journey?.selectedCareer === c.title && "border-primary"
                  )}
                >
                  <CardContent className="pt-6 pb-4 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">{c.title}</h3>
                      {c.matchScore != null && (
                        <Badge variant="secondary">{c.matchScore}% match</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.why}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {c.outlook && <Badge variant="outline">{c.outlook} demand</Badge>}
                      {c.salaryRange && <Badge variant="outline">{c.salaryRange}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(c.keySkills || []).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="pb-6">
                    <Button
                      className="w-full"
                      disabled={loading}
                      onClick={() => run(() => selectCareerAndAnalyzeGaps(c.title), "skillgap")}
                    >
                      {loading && journey?.selectedCareer === c.title ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Choose this career"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "skillgap" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ScanSearch className="w-5 h-5 text-primary" />
            Skill Gap Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            For <span className="text-foreground font-medium">{journey?.selectedCareer}</span>
          </p>
          {journey?.skillGap?.summary && (
            <p className="text-sm text-muted-foreground">{journey.skillGap.summary}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border">
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">You already have</h3>
                <div className="flex flex-wrap gap-1.5">
                  {have.length ? have.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  )) : <p className="text-sm text-muted-foreground">None listed yet.</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Skills to learn</h3>
                <div className="space-y-2">
                  {missing.length ? missing.map((s) => {
                    const name = typeof s === "string" ? s : s.skill;
                    return (
                      <div key={name} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{name}</p>
                          {s.importance && <Badge variant="outline">{s.importance}</Badge>}
                        </div>
                        {s.why && <p className="text-xs text-muted-foreground mt-1">{s.why}</p>}
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground">Generate a career match first.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
          <Button disabled={loading || !journey?.skillGap} onClick={() => run(generateDiscoveryRoadmap, "roadmap")}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Build my roadmap"}
          </Button>
        </div>
      )}

      {step === "roadmap" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            Career Roadmap
          </h2>
          {phases.length === 0 ? (
            <Card className="border">
              <CardContent className="py-10 text-center text-muted-foreground">Complete skill gap analysis first.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {phases.map((p) => (
                <Card key={p.month} className="border py-0 gap-0">
                  <CardContent className="pt-6 pb-6 space-y-2">
                    <Badge variant="outline">Month {p.month}</Badge>
                    <h3 className="font-bold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.focus}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(p.skills || []).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                      {(p.milestones || []).map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Button disabled={loading || !phases.length} onClick={() => run(generateDiscoveryCourses, "courses")}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Recommend courses"}
          </Button>
        </div>
      )}

      {step === "courses" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Course Recommendation
          </h2>
          {courses.length === 0 ? (
            <Card className="border">
              <CardContent className="py-10 text-center text-muted-foreground">Generate a roadmap first.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((c) => (
                <Card key={`${c.title}-${c.platform}`} className="border flex flex-col py-0 gap-0">
                  <CardContent className="pt-6 pb-4 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold">{c.title}</h3>
                      <Badge variant="outline">{c.cost || "—"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.platform} · {c.skill}</p>
                    <p className="text-sm text-muted-foreground">{c.reason}</p>
                  </CardContent>
                  <CardFooter className="pb-6">
                    {c.url ? (
                      <Button asChild variant="outline" className="w-full">
                        <a href={c.url} target="_blank" rel="noreferrer">Open course</a>
                      </Button>
                    ) : null}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          <Button disabled={loading || !courses.length} onClick={() => run(generateLearningPlan, "planner")}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create weekly plan"}
          </Button>
        </div>
      )}

      {step === "planner" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Learning Planner
            </h2>
            {totalTasks > 0 && (
              <p className="text-sm text-muted-foreground">
                {doneTasks}/{totalTasks} tasks complete
              </p>
            )}
          </div>
          {weeks.length === 0 ? (
            <Card className="border">
              <CardContent className="py-10 text-center text-muted-foreground">Generate courses first, then create a plan.</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {weeks.map((week) => (
                <Card key={week.week} className="border">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">Week {week.week}</h3>
                      <span className="text-sm text-muted-foreground">{week.theme}</span>
                    </div>
                    <div className="space-y-2">
                      {(week.tasks || []).map((task) => (
                        <label
                          key={task.id}
                          className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(task.done)}
                            onChange={async (e) => {
                              try {
                                const next = await toggleLearningTask(task.id, e.target.checked);
                                setJourney(next);
                              } catch (err) {
                                toast.error(err.message);
                              }
                            }}
                          />
                          <span className={cn("text-sm", task.done && "line-through text-muted-foreground")}>
                            {task.title}
                            {task.hours ? <span className="text-muted-foreground"> · {task.hours}h</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 animate-spin" />
          Working with Gemini on this step…
        </p>
      )}
    </div>
  );
}
