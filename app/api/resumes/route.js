// ==================================================================
// File: app/api/resumes/route.js
// Description: API routes for listing and creating resumes (CLERK AUTH)
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// GET - Fetch all resumes for the user
export async function GET(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user in database by clerkUserId
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resumes = await db.resume.findMany({
      where: {
        userId: user.id,
      },
      include: {
        experiences: {
          orderBy: { order: 'asc' },
        },
        education: {
          orderBy: { order: 'asc' },
        },
        skills: {
          orderBy: { order: 'asc' },
        },
        projects: {
          orderBy: { order: 'asc' },
        },
        certifications: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    return NextResponse.json(
      { error: "Failed to fetch resumes" },
      { status: 500 }
    );
  }
}

// POST - Create a new resume
export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user in database by clerkUserId
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      template = "modern",
      fullName,
      email,
      phone,
      location,
      linkedin,
      portfolio,
      github,
      summary,
      experiences = [],
      education = [],
      skills = [],
      projects = [],
      certifications = [],
    } = body;

    // Create resume with all relations
    const resume = await db.resume.create({
      data: {
        userId: user.id,
        title,
        template,
        fullName,
        email,
        phone,
        location,
        linkedin,
        portfolio,
        github,
        summary,
        experiences: {
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
        },
        education: {
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
        },
        skills: {
          create: skills.map((skill, index) => ({
            category: skill.category,
            name: skill.name,
            level: skill.level,
            order: index,
          })),
        },
        projects: {
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
        },
        certifications: {
          create: certifications.map((cert, index) => ({
            name: cert.name,
            issuer: cert.issuer,
            issueDate: cert.issueDate,
            expiryDate: cert.expiryDate,
            credentialId: cert.credentialId,
            credentialUrl: cert.credentialUrl,
            order: index,
          })),
        },
      },
      include: {
        experiences: true,
        education: true,
        skills: true,
        projects: true,
        certifications: true,
      },
    });

    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    console.error("Error creating resume:", error);
    return NextResponse.json(
      { error: "Failed to create resume" },
      { status: 500 }
    );
  }
}