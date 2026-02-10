import { memo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { HelpIcon } from '../HelpIcon';

export interface ActionButtonsSectionProps {
  onReset: () => void;
  onDelete: () => void;
  resetDisabled?: boolean;
}

export const ActionButtonsSection = memo<ActionButtonsSectionProps>(({ onReset, onDelete, resetDisabled = false }) => {
  return (
    <div className="mt-auto flex gap-2 pt-2" data-testid="action-buttons-section">
      <div className="flex-1">
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-full justify-center rounded-[20px] border-blue-100/50 bg-blue-50/50 text-xs font-semibold text-blue-600 shadow-none hover:border-blue-200 hover:bg-blue-100 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onReset}
          disabled={resetDisabled}
          data-testid="reset-button"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Reset
          <span className="ml-1">
            <HelpIcon content="Returns this object to its original position." />
          </span>
        </Button>
      </div>

      <div className="flex-1">
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-full justify-center rounded-[20px] border-red-100/50 bg-red-50/50 text-xs font-semibold text-red-500 shadow-none hover:border-red-200 hover:bg-red-100 hover:text-red-600"
          onClick={onDelete}
          data-testid="delete-button"
        >
          <Trash2 size={14} className="mr-1.5" />
          Delete
        </Button>
      </div>
    </div>
  );
});
ActionButtonsSection.displayName = 'ActionButtonsSection';

