import React from 'react';
import { SimStep } from '../../types';

interface PreviewInfoCardProps {
  step: SimStep;
  onContinue: () => void;
}

// Color theme configurations matching StepCard
const COLOR_THEMES: Record<
  'blue' | 'green' | 'yellow' | 'red' | 'gray',
  {
    headingBg: string;
    headingText: string;
  }
> = {
  blue: {
    headingBg: 'bg-blue-600',
    headingText: 'text-white',
  },
  green: {
    headingBg: 'bg-emerald-600',
    headingText: 'text-white',
  },
  yellow: {
    headingBg: 'bg-amber-500',
    headingText: 'text-white',
  },
  red: {
    headingBg: 'bg-rose-600',
    headingText: 'text-white',
  },
  gray: {
    headingBg: 'bg-slate-600',
    headingText: 'text-white',
  },
};

/**
 * Full-screen info card overlay for preview mode.
 * Displays the step's heading, body text, and continue button.
 */
export const PreviewInfoCard: React.FC<PreviewInfoCardProps> = ({ step, onContinue }) => {
  const cardColor = step.cardColor || 'blue';
  const theme = COLOR_THEMES[cardColor];
  const heading = step.heading || '';
  const bodyText = step.bodyText || '';
  const buttonText = step.buttonText || 'Continue';

  // Handle keyboard (Enter to continue, Escape to exit handled by parent)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onContinue();
    }
  };

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm duration-300"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Info Card - with smooth slide-up and scale animation */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 shadow-2xl backdrop-blur-sm"
        style={{
          animation: 'slideUpAndScale 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          animationFillMode: 'both',
        }}
      >
        {/* Heading Section - Colored */}
        <div
          className={`${theme.headingBg} rounded-t-[20px] px-6 py-4`}
          style={{
            animation: 'fadeIn 0.3s ease-out 0.1s',
            animationFillMode: 'both',
          }}
        >
          <h2 className={`text-lg font-medium leading-tight ${theme.headingText}`}>
            {heading || 'Information'}
          </h2>
        </div>

        {/* Body Text Section */}
        <div
          className="px-6 py-5"
          style={{
            animation: 'fadeIn 0.3s ease-out 0.2s',
            animationFillMode: 'both',
          }}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {bodyText || 'No content provided.'}
          </p>
        </div>

        {/* Button Section */}
        <div
          className="flex justify-center border-t border-white/30 px-6 py-4"
          style={{
            animation: 'fadeIn 0.3s ease-out 0.3s',
            animationFillMode: 'both',
          }}
        >
          <button
            onClick={onContinue}
            className="rounded-[12px] bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 active:scale-95"
          >
            {buttonText}
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUpAndScale {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
