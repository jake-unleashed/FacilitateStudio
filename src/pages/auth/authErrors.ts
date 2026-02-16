export function toFriendlyAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (normalized.includes('expired')) {
    return 'This link has expired. Please request a new one.';
  }

  if (normalized.includes('password')) {
    return 'Your password does not meet requirements. Try at least 6 characters.';
  }

  if (normalized.includes('email')) {
    return 'Please enter a valid email address.';
  }

  return 'Authentication failed. Please try again.';
}

export function isEmailNotConfirmedError(message: string): boolean {
  return message.toLowerCase().includes('email not confirmed');
}
