import { useEffect } from 'react';
import type { SimStep } from '../../types';
import { TEXTAREA_CONFIG } from './constants';

export interface StepCardTextareaArgs {
  isOpen: boolean;
  step: SimStep;
  editingField: 'heading' | 'bodyText' | 'buttonText' | null;

  stepName: string;
  heading: string;
  bodyText: string;

  stepNameTextareaRef: React.RefObject<HTMLTextAreaElement>;
  headingTextareaRef: React.RefObject<HTMLTextAreaElement>;
  bodyTextTextareaRef: React.RefObject<HTMLTextAreaElement>;
  buttonTextInputRef: React.RefObject<HTMLInputElement>;
}

export function useStepCardTextareas({
  isOpen,
  step,
  editingField,
  stepName,
  heading,
  bodyText,
  stepNameTextareaRef,
  headingTextareaRef,
  bodyTextTextareaRef,
  buttonTextInputRef,
}: StepCardTextareaArgs): void {
  // Auto-focus step name input when newly created (empty step)
  useEffect(() => {
    if (isOpen && step.title === '' && step.type === null) {
      const timer = setTimeout(() => {
        stepNameTextareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step.title, step.type, stepNameTextareaRef]);

  // Auto-resize textareas
  useEffect(() => {
    const textarea = stepNameTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_CONFIG.MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > TEXTAREA_CONFIG.MAX_HEIGHT ? 'auto' : 'hidden';
  }, [stepName, stepNameTextareaRef]);

  useEffect(() => {
    const textarea = headingTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_CONFIG.MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > TEXTAREA_CONFIG.MAX_HEIGHT ? 'auto' : 'hidden';
  }, [heading, headingTextareaRef]);

  useEffect(() => {
    const textarea = bodyTextTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
  }, [bodyText, bodyTextTextareaRef]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingField === 'heading' && headingTextareaRef.current) {
      headingTextareaRef.current.focus();
    } else if (editingField === 'bodyText' && bodyTextTextareaRef.current) {
      bodyTextTextareaRef.current.focus();
    } else if (editingField === 'buttonText' && buttonTextInputRef.current) {
      buttonTextInputRef.current.focus();
    }
  }, [editingField, headingTextareaRef, bodyTextTextareaRef, buttonTextInputRef]);
}

