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

export const CATEGORY_SHOWCASE = [
  { category: "hackathon", label: "Hackathons", icon: "Code2", gradient: "from-violet-500 to-purple-600", iconBg: "bg-violet-400/20" },
  { category: "grant", label: "Grants", icon: "Banknote", gradient: "from-emerald-500 to-teal-600", iconBg: "bg-emerald-400/20" },
  { category: "internship", label: "Internships", icon: "Briefcase", gradient: "from-amber-500 to-orange-600", iconBg: "bg-amber-400/20" },
  { category: "fellowship", label: "Fellowships", icon: "GraduationCap", gradient: "from-sky-500 to-blue-600", iconBg: "bg-sky-400/20" },
  { category: "competition", label: "Competitions", icon: "Trophy", gradient: "from-rose-500 to-pink-600", iconBg: "bg-rose-400/20" },
  { category: "scholarship", label: "Scholarships", icon: "BookOpen", gradient: "from-teal-500 to-cyan-600", iconBg: "bg-teal-400/20" },
] as const;

export const CATEGORY_GRADIENTS: Record<string, string> = {
  hackathon: "from-violet-500 to-purple-600",
  grant: "from-emerald-500 to-teal-600",
  fellowship: "from-sky-500 to-blue-600",
  internship: "from-amber-500 to-orange-600",
  competition: "from-rose-500 to-pink-600",
  scholarship: "from-teal-500 to-cyan-600",
  program: "from-indigo-500 to-violet-600",
  other: "from-stone-400 to-stone-500",
};

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
