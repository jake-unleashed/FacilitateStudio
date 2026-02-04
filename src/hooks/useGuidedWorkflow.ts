import { useGuidedWorkflowContext } from '../contexts/GuidedWorkflowContext';

/**
 * Convenience hook for consuming guided workflow state/actions.
 */
export function useGuidedWorkflow(): ReturnType<typeof useGuidedWorkflowContext> {
  return useGuidedWorkflowContext();
}
