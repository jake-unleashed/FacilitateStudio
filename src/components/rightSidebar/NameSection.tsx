import React, { memo, useCallback } from 'react';
import { Input } from '../Input';

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
    <Input
      label="Name"
      value={name}
      onChange={handleChange}
      className="text-sm font-semibold"
      data-testid="object-name-input"
    />
  );
});
NameSection.displayName = 'NameSection';

