export const YEAR_OF_STUDY_OPTIONS = [
  "1st Year", "2nd Year", "3rd Year", "Final Year", "Postgraduate",
];

export const DEGREE_OPTIONS = [
  "Undergraduate (BA/BS/BSc)",
  "Engineering (B.Tech/B.E.)",
  "Masters (MA/MS/MSc)",
  "MBA/PGDM",
  "PhD/Doctoral",
  "Diploma/Certificate",
  "Other",
];

export const INDIAN_STATES = [
  "Pan India",
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const ASPIRATION_OPTIONS = [
  "hackathons", "internships", "grants", "fellowships",
  "competitions", "scholarships", "research", "startups",
];

export const INTEREST_SUGGESTIONS = [
  "AI", "ML", "Data", "Robotics", "Web", "Mobile", "Cloud",
  "Security", "Blockchain", "Fintech", "Health", "Climate",
  "Education", "Social Impact", "Design", "Product", "Startup",
  "Research", "Hardware", "IoT",
];

export const CATEGORY_TILES: { key: string; label: string; icon: string; bg: string; text: string; border: string }[] = [
  { key: "hackathon",   label: "Hackathons",    icon: "Code2",         bg: "bg-violet-50 dark:bg-violet-950/30",  text: "text-violet-600 dark:text-violet-300",  border: "border-violet-200/60 dark:border-violet-800/40" },
  { key: "internship",  label: "Internships",   icon: "Briefcase",     bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-600 dark:text-amber-300",    border: "border-amber-200/60 dark:border-amber-800/40" },
  { key: "grant",       label: "Grants",        icon: "Banknote",      bg: "bg-emerald-50 dark:bg-emerald-950/30",text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/60 dark:border-emerald-800/40" },
  { key: "fellowship",  label: "Fellowships",   icon: "GraduationCap", bg: "bg-sky-50 dark:bg-sky-950/30",        text: "text-sky-600 dark:text-sky-300",        border: "border-sky-200/60 dark:border-sky-800/40" },
  { key: "competition", label: "Competitions",  icon: "Trophy",        bg: "bg-rose-50 dark:bg-rose-950/30",      text: "text-rose-600 dark:text-rose-300",      border: "border-rose-200/60 dark:border-rose-800/40" },
  { key: "scholarship", label: "Scholarships",  icon: "BookOpen",      bg: "bg-teal-50 dark:bg-teal-950/30",      text: "text-teal-600 dark:text-teal-300",      border: "border-teal-200/60 dark:border-teal-800/40" },
  { key: "program",     label: "Programs",      icon: "Layers",        bg: "bg-indigo-50 dark:bg-indigo-950/30",  text: "text-indigo-600 dark:text-indigo-300",  border: "border-indigo-200/60 dark:border-indigo-800/40" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  hackathon: "bg-violet-100 text-violet-700",
  grant: "bg-emerald-100 text-emerald-700",
  fellowship: "bg-sky-100 text-sky-700",
  internship: "bg-amber-100 text-amber-700",
  competition: "bg-rose-100 text-rose-700",
  scholarship: "bg-teal-100 text-teal-700",
  program: "bg-indigo-100 text-indigo-700",
  other: "bg-stone-100 text-stone-600",
};
