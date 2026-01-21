import { memo, useCallback } from 'react';
import { AlertTriangle, Check, Loader2, Redo, Save, Undo } from 'lucide-react';
import { Button } from '../Button';
import type { SaveStatus } from '../../hooks/useProjectAutoSave';

const SaveStatusIcon = ({ status }: { status: SaveStatus }) => {
  if (status === 'saving') return <Loader2 size={18} className="animate-spin" />;
  if (status === 'error') return <AlertTriangle size={18} />;

  if (status === 'saved') {
    return (
      <div className="relative">
        <Save size={18} />
        <div className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-green-500">
          <Check size={8} strokeWidth={3} className="text-white" />
        </div>
      </div>
    );
  }

  return <Save size={18} />;
};

const getSaveTooltip = (status: SaveStatus, errorMessage?: string | null) => {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'All changes saved';
  if (status === 'error')
    return errorMessage
      ? `Save failed: ${errorMessage}. Click to retry.`
      : 'Save failed — Click to retry';
  if (status === 'dirty') return 'Unsaved changes — Click to save now';
  return 'Auto-save';
};

export const HistoryControls = memo(
  ({
    saveStatus = 'idle',
    saveErrorMessage,
    onManualSave,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
  }: {
    saveStatus?: SaveStatus;
    saveErrorMessage?: string | null;
    onManualSave?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
  }) => {
    const canSave = (saveStatus === 'dirty' || saveStatus === 'error') && !!onManualSave;
    const isDisabled = saveStatus === 'saving' || !canSave;

    const handleUndo = useCallback(() => {
      if (canUndo && onUndo) onUndo();
    }, [canUndo, onUndo]);

    const handleRedo = useCallback(() => {
      if (canRedo && onRedo) onRedo();
    }, [canRedo, onRedo]);

    return (
      <div className="hidden items-center gap-1 sm:flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Save"
          className={`h-10 w-10 rounded-[20px] transition-all duration-300 ${
            saveStatus === 'dirty' ? 'text-amber-600 hover:text-amber-700' : ''
          } ${saveStatus === 'error' ? 'text-red-600 hover:text-red-700' : ''} ${
            saveStatus === 'saved' || saveStatus === 'idle' ? 'text-slate-600' : ''
          } ${saveStatus === 'saving' ? 'text-blue-600' : ''} ${canSave ? 'cursor-pointer' : 'cursor-default'}`}
          title={getSaveTooltip(saveStatus, saveErrorMessage)}
          disabled={isDisabled}
          onClick={canSave ? onManualSave : undefined}
        >
          <SaveStatusIcon status={saveStatus} />
        </Button>

        <div className="ml-1 flex items-center gap-1 rounded-[20px] border border-white/20 bg-slate-100/30 p-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canUndo}
            aria-label="Undo"
            className={`h-9 w-9 rounded-[20px] transition-all ${
              canUndo
                ? 'cursor-pointer text-slate-700 hover:bg-white/50 hover:text-slate-900'
                : 'cursor-not-allowed text-slate-400 opacity-50'
            }`}
            title={canUndo ? 'Undo (Ctrl+Z)' : 'Nothing to undo'}
            onClick={handleUndo}
          >
            <Undo size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canRedo}
            aria-label="Redo"
            className={`h-9 w-9 rounded-[20px] transition-all ${
              canRedo
                ? 'cursor-pointer text-slate-700 hover:bg-white/50 hover:text-slate-900'
                : 'cursor-not-allowed text-slate-400 opacity-50'
            }`}
            title={canRedo ? 'Redo (Ctrl+Y)' : 'Nothing to redo'}
            onClick={handleRedo}
          >
            <Redo size={16} />
          </Button>
        </div>
      </div>
    );
  }
);
HistoryControls.displayName = 'HistoryControls';

