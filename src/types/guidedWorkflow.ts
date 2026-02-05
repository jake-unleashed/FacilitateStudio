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
  /**
   * Whether the user has seen the step setup intro screen.
   * This avoids dropping users straight into per-step configuration without context.
   */
  hasSeenStepSetupIntro: boolean;
  /**
   * Step IDs that the user explicitly chose to leave blank during step setup.
   * This lets us restore "Leave blank for now" as the user's selection when revisiting a step.
   */
  stepSetupBlankStepIds: string[];
  /**
   * How Step Setup should open when entering the phase.
   * - intro: show the intro screen first
   * - resume: jump back into the last configured step/sub-screen (used when returning from the finish phase)
   */
  stepSetupEntryMode: 'intro' | 'resume';
  /**
   * When resuming step setup, where to land.
   */
  stepSetupResume:
    | {
        stepIndex: number;
        subScreen: 'type' | 'settings';
      }
    | null;
  /**
   * Whether the user has previewed from the finish phase.
   */
  hasPreviewedInFinishPhase: boolean;
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
  markStepSetupIntroSeen: () => void;
  setStepSetupBlankChoice: (stepId: string, isBlank: boolean) => void;
  setStepSetupEntryMode: (mode: GuidedWorkflowState['stepSetupEntryMode']) => void;
  setStepSetupResume: (resume: GuidedWorkflowState['stepSetupResume']) => void;
  markFinishPreviewDone: () => void;
  exitWorkflow: () => void;
}
