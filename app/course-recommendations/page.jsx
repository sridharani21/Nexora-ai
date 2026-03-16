"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  BookOpen,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  Menu,
  X,
} from "lucide-react";
import CourseCard from "@/components/CourseCard";

const DOMAINS = [
  "Full Stack Development",
  "Data Science",
  "Machine Learning / AI",
  "Cloud Computing",
  "Cybersecurity",
  "UI/UX Design",
  "DevOps",
  "Mobile Development",
  "Blockchain",
  "Product Management",
];

export default function CourseRecommendationsPage() {
  const [file, setFile] = useState(null);
  const [domain, setDomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Auto scroll to results
  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/courses/recommend");
      const data = await res.json();
      setHistory(data.recommendations || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Poll for new results after submission
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/courses/recommend");
        const data = await res.json();
        if (data.recommendations?.length > 0) {
          const latest = data.recommendations[0];
          const createdAt = new Date(latest.createdAt);
          const now = new Date();
          const diffMs = now - createdAt;
          if (diffMs < 120000) {
            setResults(latest.courses);
            setHistory(data.recommendations);
            setPolling(false);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);

    const timeout = setTimeout(() => {
      setPolling(false);
      setLoading(false);
      setError("Analysis is taking longer than expected. Please try again.");
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [polling]);

  const handleSubmit = async () => {
    const selectedDomain = domain === "Other" ? customDomain : domain;
    if (!file) return setError("Please upload your resume.");
    if (!selectedDomain) return setError("Please select a domain.");

    setError("");
    setLoading(true);
    setResults(null);
    setSelectedHistory(null);

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("domain", selectedDomain);

    try {
      const res = await fetch("/api/courses/recommend", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPolling(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  const handleHistoryClick = (item) => {
    setSelectedHistory(item.id);
    setResults(item.courses);
    setSidebarOpen(false); // Close sidebar on mobile after selection
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-screen overflow-hidden pt-16">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 rounded-lg bg-background border border-border shadow-lg"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-80 bg-background border-r border-border transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col pt-16 lg:pt-0`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">History</h2>
            <Badge variant="secondary" className="text-xs ml-auto">
              {history.length}
            </Badge>
          </div>
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No history yet
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                  selectedHistory === item.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <p className="font-medium text-sm truncate">{item.domain}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="truncate">{formatDate(item.createdAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {item.skills?.slice(0, 2).map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="text-xs"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {item.skills?.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{item.skills.length - 2}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {item.courses?.free?.length || 0} free · {item.courses?.paid?.length || 0} paid
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold gradient-title flex items-center gap-3">
              <Sparkles className="text-yellow-500 w-8 h-8" />
              Course Recommendations
            </h1>
            <p className="text-muted-foreground text-base">
              Upload your resume and choose a domain — we'll recommend the best
              free and paid courses tailored to your skill gaps.
            </p>
          </div>

          {/* Input Card */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="pt-8 pb-8 px-8 space-y-8">
              {/* Resume Upload */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Upload Resume (PDF)</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
                >
                  {file ? (
                    <div className="space-y-1">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5 text-green-500" />
                      </div>
                      <p className="text-sm font-medium text-green-500">{file.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Click to upload your resume PDF</p>
                      <p className="text-xs text-muted-foreground">PDF files only</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </div>

              {/* Domain Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Domain of Interest</Label>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDomain(d)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                        domain === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={() => setDomain("Other")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                      domain === "Other"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-foreground"
                    }`}
                  >
                    Other
                  </button>
                </div>
                {domain === "Other" && (
                  <Input
                    placeholder="Type your domain of interest..."
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="mt-2 max-w-sm"
                  />
                )}
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {polling ? "Analyzing your resume..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <BookOpen className="w-5 h-5 mr-2" />
                    Get Course Recommendations
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          {results && (
            <div ref={resultsRef} className="space-y-6 pb-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">
                  {selectedHistory ? "Selected Recommendations" : "Latest Recommendations"}
                </h2>
              </div>

              {/* Skills Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.currentSkills?.length > 0 && (
                  <Card className="border border-border/50">
                    <CardContent className="pt-5 pb-5 px-5 space-y-3">
                      <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                        Your Current Skills
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {results.currentSkills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {results.skillGaps?.length > 0 && (
                  <Card className="border border-border/50">
                    <CardContent className="pt-5 pb-5 px-5 space-y-3">
                      <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                        Skill Gaps Identified
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {results.skillGaps.map((gap) => (
                          <Badge key={gap} variant="destructive" className="text-xs">
                            {gap}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Course Tabs */}
              <Tabs defaultValue="free">
                <TabsList className="w-full h-11">
                  <TabsTrigger value="free" className="w-1/2 text-sm">
                    🆓 Free Courses ({results.free?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="paid" className="w-1/2 text-sm">
                    💳 Paid Courses ({results.paid?.length || 0})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="free" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.free?.map((course, i) => (
                      <CourseCard key={i} course={course} type="free" />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="paid" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.paid?.map((course, i) => (
                      <CourseCard key={i} course={course} type="paid" />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}