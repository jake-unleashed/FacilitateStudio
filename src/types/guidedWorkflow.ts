export type GuidedWorkflowPhase =
  | 'welcome'
  | 'step-creation'
  | 'model-upload'
  | 'model-positioning'
  | 'step-configuration'
  | 'finish';

export type StepCreationMethod = 'sop' | 'manual' | null;

export interface GuidedWorkflowState {
  isActive: boolean;
  /**
   * True once the user has made an entry choice for this project (guided or editor).
   * Prevents repeatedly re-showing the WelcomeModal for an empty project.
   */
  hasDismissedWelcome: boolean;
  currentPhase: GuidedWorkflowPhase;
  currentStepIndex: number;
  pendingSteps: string[];
  creationMethod: StepCreationMethod;
}

export interface GuidedWorkflowActions {
  startWorkflow: () => void;
  skipToEditor: () => void;
  nextPhase: () => void;
  previousPhase: () => void;
  setCurrentStepIndex: (index: number) => void;
  setPendingSteps: (steps: string[]) => void;
  setCreationMethod: (method: StepCreationMethod) => void;
  exitWorkflow: () => void;
}
