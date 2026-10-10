import { z } from "zod";

export const prepProfileInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  education: z.string().trim().max(240).optional(),
  skills: z.string().trim().max(4000).optional(),
  languages: z.string().trim().max(2000).optional(),
  projects: z.string().trim().max(8000).optional(),
  certifications: z.string().trim().max(4000).optional(),
  interests: z.string().trim().max(2000).optional(),
  preferredRole: z.string().trim().max(160).optional(),
  targetCompany: z.string().trim().max(160).optional(),
  location: z.string().trim().max(240).optional(),
});

export function buildPrepProfileData(values, existingProfile, identity) {
  const profileData = {
    fullName: values.fullName ?? existingProfile?.fullName ?? identity.fullName,
    clerkUserId: identity.clerkUserId,
    email: identity.email,
    education: values.education !== undefined ? values.education || null : existingProfile?.education ?? null,
    skills: values.skills ?? existingProfile?.skills ?? "",
    languages: values.languages ?? existingProfile?.languages ?? "",
    projects: values.projects ?? existingProfile?.projects ?? "",
    certifications: values.certifications ?? existingProfile?.certifications ?? "",
    interests: values.interests ?? existingProfile?.interests ?? "",
    preferredRole: values.preferredRole !== undefined ? values.preferredRole || null : existingProfile?.preferredRole ?? null,
    targetCompany: values.targetCompany !== undefined ? values.targetCompany || null : existingProfile?.targetCompany ?? null,
    location: values.location !== undefined ? values.location || null : existingProfile?.location ?? null,
  };
  if (!profileData.fullName) throw new Error("Full name is required.");
  return profileData;
}
