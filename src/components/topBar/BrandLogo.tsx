import React, { memo } from 'react';

export interface BrandLogoProps {
  onClick: () => void;
}

/**
 * Brand logo with gradient hover effect.
 * Uses a two-layer approach: gradient layer underneath, solid overlay on top.
 * The solid overlay fades out on hover to reveal the gradient.
 * Clicking navigates back to the home page.
 */
export const BrandLogo = memo<BrandLogoProps>(({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex cursor-pointer select-none flex-col justify-center focus:outline-none"
    title="Back to Home"
  >
    <h1 className="relative text-xl font-bold leading-none tracking-tight">
      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent [backface-visibility:hidden]">
        Facilitate
      </span>
      <span
        className="pointer-events-none absolute inset-0 text-slate-800 transition-opacity duration-300 ease-in-out will-change-[opacity] [backface-visibility:hidden] group-hover:opacity-0"
        aria-hidden="true"
      >
        Facilitate
      </span>
    </h1>
    <span className="ml-0.5 mt-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.35em] text-slate-400 transition-colors duration-300 ease-in-out group-hover:text-blue-500">
      Studio
    </span>
  </button>
));
BrandLogo.displayName = 'BrandLogo';

