// ==================================================================
// File: app/api/resumes/[id]/route.js
// Description: API routes for individual resume operations (CLERK AUTH)
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { triggerResumeUpdate } from "@/lib/inngest-helpers";

// GET - Fetch a specific resume
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params; // ✅ await params

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resume = await db.resume.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        experiences: { orderBy: { order: 'asc' } },
        education: { orderBy: { order: 'asc' } },
        skills: { orderBy: { order: 'asc' } },
        projects: { orderBy: { order: 'asc' } },
        certifications: { orderBy: { order: 'asc' } },
      },
    });

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Error fetching resume:", error);
    return NextResponse.json({ error: "Failed to fetch resume" }, { status: 500 });
  }
}

// PATCH - Update a resume
export async function PATCH(req, { params }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params; // ✅ await params

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    // Verify ownership
    const existingResume = await db.resume.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingResume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const {
      title, template, fullName, email, phone, location,
      linkedin, portfolio, github, summary,
      experiences, education, skills, projects, certifications,
    } = body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (template !== undefined) updateData.template = template;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;
    if (linkedin !== undefined) updateData.linkedin = linkedin;
    if (portfolio !== undefined) updateData.portfolio = portfolio;
    if (github !== undefined) updateData.github = github;
    if (summary !== undefined) updateData.summary = summary;

    if (experiences) {
      await db.experience.deleteMany({ where: { resumeId: id } });
      updateData.experiences = {
        create: experiences.map((exp, index) => ({
          company: exp.company,
          position: exp.position,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          current: exp.current || false,
          description: exp.description || [],
          order: index,
        })),
      };
    }

    if (education) {
      await db.education.deleteMany({ where: { resumeId: id } });
      updateData.education = {
        create: education.map((edu, index) => ({
          institution: edu.institution,
          degree: edu.degree,
          field: edu.field,
          location: edu.location,
          startDate: edu.startDate,
          endDate: edu.endDate,
          gpa: edu.gpa,
          achievements: edu.achievements || [],
          order: index,
        })),
      };
    }

    if (skills) {
      await db.skill.deleteMany({ where: { resumeId: id } });
      updateData.skills = {
        create: skills.map((skill, index) => ({
          category: skill.category,
          name: skill.name,
          level: skill.level,
          order: index,
        })),
      };
    }

    if (projects) {
      await db.project.deleteMany({ where: { resumeId: id } });
      updateData.projects = {
        create: projects.map((project, index) => ({
          name: project.name,
          description: project.description,
          technologies: project.technologies || [],
          link: project.link,
          github: project.github,
          startDate: project.startDate,
          endDate: project.endDate,
          highlights: project.highlights || [],
          order: index,
        })),
      };
    }

    if (certifications) {
      await db.certification.deleteMany({ where: { resumeId: id } });
      updateData.certifications = {
        create: certifications.map((cert, index) => ({
          name: cert.name,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          credentialId: cert.credentialId,
          credentialUrl: cert.credentialUrl,
          order: index,
        })),
      };
    }

    const resume = await db.resume.update({
      where: { id }, // ✅ uses awaited id
      data: updateData,
      include: {
        experiences: { orderBy: { order: 'asc' } },
        education: { orderBy: { order: 'asc' } },
        skills: { orderBy: { order: 'asc' } },
        projects: { orderBy: { order: 'asc' } },
        certifications: { orderBy: { order: 'asc' } },
      },
    });

    try {
      await triggerResumeUpdate(id, user.id);
    } catch (error) {
      console.error("Failed to trigger resume update event:", error);
    }

    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Error updating resume:", error);
    return NextResponse.json({ error: "Failed to update resume" }, { status: 500 });
  }
}

// DELETE - Delete a resume
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params; // ✅ await params

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingResume = await db.resume.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingResume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    await db.resume.delete({
      where: { id }, // ✅ uses awaited id
    });

    return NextResponse.json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
  }
}