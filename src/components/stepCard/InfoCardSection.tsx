import type { RefObject } from 'react';
import { Maximize2, PanelRight, Pencil } from 'lucide-react';
import type { InfoCardDisplayMode, SimStep } from '../../types';
import { COLOR_THEMES } from './constants';
import { HelpIcon } from '../HelpIcon';

export interface InfoCardSectionProps {
  step: SimStep;
  stepName: string;
  selectedType: SimStep['type'];
  isVisible: boolean;
  compact?: boolean;

  editingField: 'heading' | 'bodyText' | 'buttonText' | null;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  infoCardDisplayMode: InfoCardDisplayMode;
  currentTheme: (typeof COLOR_THEMES)[keyof typeof COLOR_THEMES];

  headingTextareaRef: RefObject<HTMLTextAreaElement>;
  bodyTextTextareaRef: RefObject<HTMLTextAreaElement>;
  buttonTextInputRef: RefObject<HTMLInputElement>;

  onStartEdit: (field: 'heading' | 'bodyText' | 'buttonText') => void;
  onFieldBlur: (field: 'heading' | 'bodyText' | 'buttonText', value: string) => void;
  onSetCardColor: (color: 'blue' | 'green' | 'yellow' | 'red' | 'gray') => void;
  onSetInfoCardDisplayMode: (mode: InfoCardDisplayMode) => void;
}

export function InfoCardSection(props: InfoCardSectionProps): JSX.Element | null {
  const {
    isVisible,
    compact = false,
    editingField,
    heading,
    bodyText,
    buttonText,
    cardColor,
    infoCardDisplayMode,
    currentTheme,
    headingTextareaRef,
    bodyTextTextareaRef,
    buttonTextInputRef,
    onStartEdit,
    onFieldBlur,
    onSetCardColor,
    onSetInfoCardDisplayMode,
  } = props;
  if (!isVisible) return null;

  return (
    <div className={`border-t border-white/30 ${compact ? 'pt-3' : 'pt-4'}`}>
      <div className={`${compact ? 'mb-3' : 'mb-4'}`}>
        <div className="flex items-center gap-2 pl-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Display Mode</h3>
          <HelpIcon content="Overlay: shows a centered card with a darkened backdrop. Side Panel: shows the card on the right side so the scene stays visible behind it." />
        </div>
        <div className="mt-2 rounded-[20px] border border-white/20 bg-slate-100/50 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => onSetInfoCardDisplayMode('overlay')}
              className={`flex items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                infoCardDisplayMode === 'overlay'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-400 hover:bg-white/50'
              }`}
              title="Centered overlay with backdrop"
              aria-label="Use overlay display mode"
            >
              <Maximize2 size={14} aria-hidden="true" />
              <span>Overlay</span>
            </button>
            <button
              onClick={() => onSetInfoCardDisplayMode('side-panel')}
              className={`flex items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                infoCardDisplayMode === 'side-panel'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-400 hover:bg-white/50'
              }`}
              title="Side panel, scene stays visible"
              aria-label="Use side panel display mode"
            >
              <PanelRight size={14} aria-hidden="true" />
              <span>Side Panel</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Preview</span>
        <HelpIcon content="Preview of how this card will appear. Click the edit icons to change the content." />
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/50 shadow-sm backdrop-blur-sm">
        <div
          className={`group relative ${currentTheme.headingBg} rounded-t-[20px] ${
            compact ? 'px-5 py-3' : 'px-6 py-4'
          }`}
        >
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

        <div className={`group relative ${compact ? 'px-5 py-4' : 'px-6 py-5'}`}>
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

        <div
          className={`group relative flex justify-center border-t border-white/30 ${
            compact ? 'px-5 py-3' : 'px-6 py-4'
          }`}
        >
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

      <div className={`flex items-center justify-center ${compact ? 'mt-3 gap-2' : 'mt-4 gap-2.5'}`}>
        {(['blue', 'green', 'yellow', 'red', 'gray'] as const).map((color) => {
          const isSelected = cardColor === color;
          const circleClass = COLOR_THEMES[color].circleColor;

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

