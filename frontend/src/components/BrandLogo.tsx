import React from "react";

export default function BrandLogo({
  className = "h-12 w-auto",
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <svg
      className={`${className} text-stone-900 dark:text-stone-100`}
      viewBox="0 0 360 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Steppd"
    >
      <g transform="translate(14 18)">
        <rect x="0" y="34" width="18" height="18" rx="4" fill="#06B6D4" />
        <rect x="14" y="22" width="18" height="18" rx="4" fill="#0891B2" />
        <rect x="28" y="10" width="18" height="18" rx="4" fill="#0E7490" />
      </g>

      <text x="74" y="43" fill="currentColor" fontFamily="Outfit, Arial, sans-serif" fontSize="36" fontWeight="700">
        Steppd
      </text>
      {showTagline && (
        <text x="76" y="66" fill="currentColor" opacity="0.8" fontFamily="Outfit, Arial, sans-serif" fontSize="17" fontWeight="600">
          Explore, Grow, Launch
        </text>
      )}
    </svg>
  );
}
