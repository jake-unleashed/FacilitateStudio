export type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password';
export type PendingEmailKind = 'sign-up' | 'password-reset';

export interface PendingEmailState {
  email: string;
  kind: PendingEmailKind;
}

export interface AuthSuccessState {
  authSuccessMessage?: string;
}
