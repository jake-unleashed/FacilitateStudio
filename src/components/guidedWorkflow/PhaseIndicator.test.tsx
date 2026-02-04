import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseIndicator } from './PhaseIndicator';

describe('PhaseIndicator', () => {
  it('renders an unlabeled progress rail with accessible progressbar', () => {
    render(<PhaseIndicator currentPhase="model-upload" />);

    const progressbar = screen.getByRole('progressbar', { name: /setup progress/i });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '6');
    expect(progressbar).toHaveAttribute('aria-valuenow', '3');

    // Ensure we are not listing phase labels (low cognitive load)
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/steps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/models/i)).not.toBeInTheDocument();
  });
});

