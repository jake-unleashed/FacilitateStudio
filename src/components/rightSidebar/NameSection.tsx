import React, { memo, useCallback } from 'react';
import { Input } from '../Input';
import { HelpIcon } from '../HelpIcon';

export interface NameSectionProps {
  name: string;
  onNameChange: (name: string) => void;
}

export const NameSection = memo<NameSectionProps>(({ name, onNameChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNameChange(e.target.value);
    },
    [onNameChange]
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Name</label>
        <HelpIcon content="The name shown in your project and in training steps." />
      </div>
      <Input
        value={name}
        onChange={handleChange}
        className="text-sm font-semibold"
        data-testid="object-name-input"
      />
    </div>
  );
});
NameSection.displayName = 'NameSection';

