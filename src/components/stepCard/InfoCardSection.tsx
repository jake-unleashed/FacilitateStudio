import React from 'react';
import { HelpCircle, Pencil } from 'lucide-react';
import type { SimStep } from '../../types';
import { COLOR_THEMES } from './constants';

export interface InfoCardSectionProps {
  step: SimStep;
  stepName: string;
  selectedType: SimStep['type'];
  isVisible: boolean;

  editingField: 'heading' | 'bodyText' | 'buttonText' | null;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  currentTheme: (typeof COLOR_THEMES)[keyof typeof COLOR_THEMES];

  headingTextareaRef: React.RefObject<HTMLTextAreaElement>;
  bodyTextTextareaRef: React.RefObject<HTMLTextAreaElement>;
  buttonTextInputRef: React.RefObject<HTMLInputElement>;

  onStartEdit: (field: 'heading' | 'bodyText' | 'buttonText') => void;
  onFieldBlur: (field: 'heading' | 'bodyText' | 'buttonText', value: string) => void;
  onSetCardColor: (color: 'blue' | 'green' | 'yellow' | 'red' | 'gray') => void;
}

export function InfoCardSection({
  step,
  stepName,
  selectedType,
  isVisible,
  editingField,
  heading,
  bodyText,
  buttonText,
  cardColor,
  currentTheme,
  headingTextareaRef,
  bodyTextTextareaRef,
  buttonTextInputRef,
  onStartEdit,
  onFieldBlur,
  onSetCardColor,
}: InfoCardSectionProps): JSX.Element | null {
  if (!isVisible) return null;

  return (
    <div className="border-t border-white/30 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Preview</span>
        <span title="Preview of how the Info Card will look. Click edit icons to change content.">
          <HelpCircle size={12} className="text-slate-400" />
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/50 shadow-sm backdrop-blur-sm">
        <div className={`group relative ${currentTheme.headingBg} rounded-t-[20px] px-6 py-4`}>
          {editingField === 'heading' ? (
            <textarea
              ref={headingTextareaRef}
              defaultValue={heading}
              onBlur={(e) => onFieldBlur('heading', e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onFieldBlur('heading', headingTextareaRef.current?.value ?? '');
                }
              }}
              placeholder="Enter heading..."
              maxLength={200}
              rows={1}
              className={`w-full resize-none border-0 bg-transparent p-0 text-base font-medium leading-tight ${currentTheme.headingText} placeholder-white/60 focus:outline-none focus:ring-0`}
              style={{ minHeight: '1.5rem' }}
            />
          ) : (
            <>
              <div
                className={`min-h-[1.5rem] cursor-pointer text-base font-medium leading-tight ${currentTheme.headingText}`}
                onClick={() => onStartEdit('heading')}
              >
                {heading || <span className="opacity-60">Enter heading...</span>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit('heading');
                }}
                className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/20 text-white opacity-70 transition-all hover:bg-white/30 hover:opacity-100"
                title="Edit heading"
                aria-label="Edit heading"
              >
                <Pencil size={12} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="group relative px-6 py-5">
          {editingField === 'bodyText' ? (
            <textarea
              ref={bodyTextTextareaRef}
              defaultValue={bodyText}
              onBlur={(e) => onFieldBlur('bodyText', e.currentTarget.value)}
              placeholder="Enter body text..."
              rows={4}
              className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0"
            />
          ) : (
            <>
              <div
                className="min-h-[4rem] cursor-pointer whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
                onClick={() => onStartEdit('bodyText')}
              >
                {bodyText || <span className="text-slate-400">Enter body text...</span>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit('bodyText');
                }}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/80 text-slate-400 opacity-70 transition-all hover:bg-white hover:text-slate-600 hover:opacity-100"
                title="Edit body text"
                aria-label="Edit body text"
              >
                <Pencil size={12} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="group relative flex justify-center border-t border-white/30 px-6 py-4">
          {editingField === 'buttonText' ? (
            <input
              ref={buttonTextInputRef}
              type="text"
              defaultValue={buttonText}
              onBlur={(e) => onFieldBlur('buttonText', e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onFieldBlur('buttonText', buttonTextInputRef.current?.value ?? '');
                }
              }}
              placeholder="OK"
              maxLength={50}
              className="rounded-[12px] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit('buttonText');
                }}
                className="rounded-[12px] bg-slate-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
                title="Edit button text"
              >
                {buttonText || 'OK'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit('buttonText');
                }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 opacity-70 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-600 hover:opacity-100"
                title="Edit button text"
                aria-label="Edit button text"
              >
                <Pencil size={10} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2.5">
        {(['blue', 'green', 'yellow', 'red', 'gray'] as const).map((color) => {
          const isSelected = cardColor === color;
          // we rely on controller to compute actual theme, but we still need circle color
          const circleClass =
            color === 'blue'
              ? 'bg-blue-600'
              : color === 'green'
                ? 'bg-emerald-600'
                : color === 'yellow'
                  ? 'bg-amber-500'
                  : color === 'red'
                    ? 'bg-rose-600'
                    : 'bg-slate-600';

          return (
            <button
              key={color}
              onClick={() => onSetCardColor(color)}
              className={`
                relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200
                ${isSelected ? 'scale-110 border-slate-400 ring-2 ring-slate-200/50' : 'border-slate-300 hover:scale-105 hover:border-slate-400'}
                ${circleClass}
              `}
              title={color.charAt(0).toUpperCase() + color.slice(1)}
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

