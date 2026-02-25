import type { SimStep } from '../../types';
import type { StepCardController } from './StepCardController.types';
import { StepCardHeader } from './StepCardHeader';
import { StepTypeSection } from './StepTypeSection';
import { InfoCardSection } from './InfoCardSection';
import { MoveItemSection } from './MoveItemSection';
import { IdentifySection } from './IdentifySection';
import { DeleteStepSection } from './DeleteStepSection';

export interface StepCardViewProps {
  step: SimStep;
  onMinimize: () => void;
  onDeleteVisible: boolean;
  controller: StepCardController;
}

export function StepCardView({ step, onMinimize, onDeleteVisible, controller }: StepCardViewProps): JSX.Element {
  return (
    <div className="rounded-[16px] border border-white/50 bg-white/50 p-4 shadow-sm backdrop-blur-sm">
      <StepCardHeader
        stepId={step.id}
        stepName={controller.stepName}
        stepNameTextareaRef={controller.stepNameTextareaRef}
        onStepNameChange={controller.handleStepNameChange}
        onStepNameBlur={(value) => controller.handleFieldBlur('stepName', value)}
        onMinimize={onMinimize}
      />

      <StepTypeSection
        selectedType={controller.selectedType}
        showTypeSelection={controller.showTypeSelection}
        currentStepTypeConfig={controller.currentStepTypeConfig}
        isInfoCardSelected={controller.isInfoCardSelected}
        onChangeStepType={controller.handleChangeStepType}
        onTypeSelect={controller.handleTypeSelect}
      />

      <InfoCardSection
        step={step}
        stepName={controller.stepName}
        selectedType={controller.selectedType}
        isVisible={controller.isInfoCardSelected && !controller.showTypeSelection}
        compact={false}
        editingField={controller.editingField}
        heading={controller.heading}
        bodyText={controller.bodyText}
        buttonText={controller.buttonText}
        cardColor={controller.cardColor}
        infoCardDisplayMode={controller.infoCardDisplayMode}
        currentTheme={controller.currentTheme}
        headingTextareaRef={controller.headingTextareaRef}
        bodyTextTextareaRef={controller.bodyTextTextareaRef}
        buttonTextInputRef={controller.buttonTextInputRef}
        onStartEdit={controller.handleStartEdit}
        onFieldBlur={(field, value) => controller.handleFieldBlur(field, value)}
        onSetCardColor={controller.handleSetCardColor}
        onSetInfoCardDisplayMode={controller.handleSetInfoCardDisplayMode}
      />

      <MoveItemSection
        step={step}
        isVisible={controller.isMoveItemSelected && !controller.showTypeSelection}
        compact={false}
        isRecordingPosition={controller.isRecordingPosition}
        targetObject={controller.targetObject}
        targetChildName={controller.targetChild?.name ?? null}
        canUseSelectedObject={controller.canUseSelectedObject}
        effectiveTargetObjectId={controller.effectiveTargetObjectId}
        effectiveTargetChildPath={controller.effectiveTargetChildPath}
        onUseSelectedObject={controller.handleUseSelectedObject}
        onRemoveTargetObject={controller.handleRemoveTargetObject}
        onFocusTargetObject={controller.handleFocusTargetObject}
        onToggleRecording={controller.handleToggleRecording}
      />

      <IdentifySection
        isVisible={controller.isIdentifySelected && !controller.showTypeSelection}
        compact={false}
        targetObject={controller.targetObject}
        targetChildName={controller.targetChild?.name ?? null}
        canUseSelectedObject={controller.canUseSelectedObject}
        effectiveTargetObjectId={controller.effectiveTargetObjectId}
        effectiveTargetChildPath={controller.effectiveTargetChildPath}
        onUseSelectedObject={controller.handleUseSelectedObject}
        onRemoveTargetObject={controller.handleRemoveTargetObject}
        onFocusTargetObject={controller.handleFocusTargetObject}
      />

      <DeleteStepSection
        isVisible={onDeleteVisible}
        confirmingDelete={controller.confirmingDelete}
        onDeleteClick={controller.handleDeleteClick}
      />
    </div>
  );
}

