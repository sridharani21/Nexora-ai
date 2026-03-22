// ==================================================================
// File: app/resume-builder/page.jsx
// Description: Dashboard for listing all user resumes
// ==================================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2, Edit, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ResumeDashboard() {
  const router = useRouter();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { loadResumes(); }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/resumes");
      if (response.ok) {
        const { resumes } = await response.json();
        setResumes(resumes);
      }
    } catch (error) {
      toast.error("Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => router.push("/resume-builder/new");
  const handleEdit = (id) => router.push(`/resume-builder/${id}`);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`/api/resumes/${deleteId}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Resume deleted successfully");
        setResumes(resumes.filter((r) => r.id !== deleteId));
        setDeleteId(null);
      } else {
        toast.error("Failed to delete resume");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const getScoreColor = (score) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDate = (date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    // ✅ pt-16 offsets the fixed navbar
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Resumes</h1>
            <p className="text-gray-600 mt-1">Create and manage your ATS-optimized resumes</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />Create New Resume
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
                </CardHeader>
                <CardContent><div className="h-24 bg-gray-200 rounded"></div></CardContent>
              </Card>
            ))}
          </div>
        ) : resumes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No resumes yet</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first ATS-optimized resume</p>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />Create Your First Resume
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumes.map((resume) => (
              <Card key={resume.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleEdit(resume.id)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{resume.title}</CardTitle>
                      <CardDescription className="line-clamp-1">{resume.fullName}</CardDescription>
                    </div>
                    {resume.atsScore && (
                      <div className={`flex flex-col items-end ${getScoreColor(resume.atsScore)}`}>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-2xl font-bold">{resume.atsScore}</span>
                        </div>
                        <span className="text-xs text-gray-500">ATS Score</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="capitalize">{resume.template}</span>
                    </div>
                    <span>Updated {formatDate(resume.updatedAt)}</span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(resume.id)}>
                      <Edit className="w-4 h-4 mr-2" />Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(resume.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Resume</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete this resume? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}