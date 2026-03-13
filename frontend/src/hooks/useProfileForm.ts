import { useState, useEffect } from "react";
import { updateProfile, type User } from "../lib/api";

interface ProfileFormState {
  firstName: string;
  setFirstName: (v: string) => void;
  academicBackground: string;
  setAcademicBackground: (v: string) => void;
  yearOfStudy: string;
  setYearOfStudy: (v: string) => void;
  userState: string;
  setUserState: (v: string) => void;
  skills: string[];
  setSkills: (v: string[]) => void;
  interests: string[];
  setInterests: (v: string[]) => void;
  aspirations: string[];
  setAspirations: (v: string[]) => void;
  skillInput: string;
  setSkillInput: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  addSkill: () => void;
  hasInterest: (interest: string) => boolean;
  toggleInterest: (interest: string) => void;
  toggleAspiration: (asp: string) => void;
  submitProfile: (password?: string) => Promise<void>;
}

export default function useProfileForm(user: User | null, onSuccess?: () => void): ProfileFormState {
  const [firstName, setFirstName] = useState("");
  const [academicBackground, setAcademicBackground] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [userState, setUserState] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [aspirations, setAspirations] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || "");
    setAcademicBackground(user.academic_background || "");
    setYearOfStudy(user.year_of_study || "");
    setUserState(user.state || "");
    setSkills(user.skills || []);
    setInterests(user.interests || []);
    setAspirations(user.aspirations || []);
  }, [user]);

  const addSkill = () => {
    const tag = skillInput.trim();
    if (tag && !skills.includes(tag)) {
      setSkills([...skills, tag]);
    }
    setSkillInput("");
  };

  const hasInterest = (interest: string) =>
    interests.some((i) => i.toLowerCase() === interest.toLowerCase());

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      const exists = prev.some((i) => i.toLowerCase() === interest.toLowerCase());
      if (exists) return prev.filter((i) => i.toLowerCase() !== interest.toLowerCase());
      return [...prev, interest];
    });
  };

  const toggleAspiration = (asp: string) => {
    setAspirations((prev) =>
      prev.includes(asp) ? prev.filter((a) => a !== asp) : [...prev, asp]
    );
  };

  const submitProfile = async (password?: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile({
        first_name: firstName,
        academic_background: academicBackground,
        year_of_study: yearOfStudy,
        state: userState,
        skills,
        interests,
        aspirations,
        ...(password ? { password } : {}),
      });
      setSuccess("vibes updated");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return {
    firstName, setFirstName,
    academicBackground, setAcademicBackground,
    yearOfStudy, setYearOfStudy,
    userState, setUserState,
    skills, setSkills,
    interests, setInterests,
    aspirations, setAspirations,
    skillInput, setSkillInput,
    loading, error, success,
    addSkill, hasInterest, toggleInterest, toggleAspiration,
    submitProfile,
  };
}
