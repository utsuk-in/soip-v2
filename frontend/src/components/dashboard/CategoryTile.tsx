import React from "react";
import { Code2, Banknote, Briefcase, GraduationCap, Trophy, BookOpen } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Code2, Banknote, Briefcase, GraduationCap, Trophy, BookOpen,
};

interface Props {
  label: string;
  icon: string;
  gradient: string;
  count: number;
  onClick: () => void;
}

export default function CategoryTile({ label, icon, gradient, count, onClick }: Props) {
  const Icon = ICONS[icon] || Code2;

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-36 sm:w-40 rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white hover:-translate-y-1 hover:shadow-xl transition-all group`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <Icon size={20} />
      </div>
      <p className="text-sm font-bold text-left">{label}</p>
      <p className="text-xs text-white/70 text-left mt-0.5">
        {count} {count === 1 ? "opportunity" : "opportunities"}
      </p>
    </button>
  );
}
