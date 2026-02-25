import React, { useId } from 'react';
import type { InfoCardDisplayMode, SimStep } from '../../types';
import { COLOR_THEMES } from '../stepCard/constants';

interface PreviewInfoCardProps {
  step: SimStep;
  displayMode: InfoCardDisplayMode;
  onContinue: () => void;
}

/**
 * Info card for preview mode.
 * Supports full-screen overlay and side panel variants.
 * Animations are defined in index.css (info-card-*).
 */
export const PreviewInfoCard: React.FC<PreviewInfoCardProps> = ({ step, displayMode, onContinue }) => {
  const cardColor = step.cardColor || 'blue';
  const theme = COLOR_THEMES[cardColor];
  const heading = step.heading || '';
  const bodyText = step.bodyText || '';
  const buttonText = step.buttonText || 'Continue';
  const isSidePanel = displayMode === 'side-panel';
  const headingId = useId();
  const bodyId = useId();

  const cardContent = (headingRadius: string, autoFocusButton: boolean) => (
    <>
      <div className={`${theme.headingBg} ${headingRadius} px-6 py-4 info-card-stagger-heading`}>
        <h2 id={headingId} className={`text-lg font-medium leading-tight ${theme.headingText}`}>
          {heading || 'Information'}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 custom-scrollbar info-card-stagger-body">
        <p id={bodyId} className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {bodyText || 'No content provided.'}
        </p>
      </div>

      <div className="flex justify-center border-t border-white/30 px-6 py-4 info-card-stagger-button">
        <button
          onClick={onContinue}
          autoFocus={autoFocusButton}
          className="rounded-[12px] bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 active:scale-95"
        >
          {buttonText}
        </button>
      </div>
    </>
  );

  const overlayWrapper = (extraClasses = '') => (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm info-card-anim-fade-in ${extraClasses}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
    >
      <div
        className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 shadow-2xl backdrop-blur-sm info-card-anim-slide-up"
      >
        {cardContent('rounded-t-[20px]', true)}
      </div>
    </div>
  );

  if (!isSidePanel) {
    return overlayWrapper();
  }

  return (
    <>
      {/* Small screens: fall back to centered overlay */}
      {overlayWrapper('sm:hidden')}

      {/* sm+ screens: right-side glass panel, scene stays interactive */}
      <div className="pointer-events-none fixed inset-0 z-50 hidden sm:block">
        <div
          className="pointer-events-auto absolute right-6 top-1/2 flex max-h-[calc(100vh-3rem)] w-80 -translate-y-1/2 flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/80 shadow-glass backdrop-blur-xl info-card-anim-slide-in-right"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          aria-describedby={bodyId}
        >
          {cardContent('rounded-t-[32px]', false)}
        </div>
      </div>
    </>
  );
};
