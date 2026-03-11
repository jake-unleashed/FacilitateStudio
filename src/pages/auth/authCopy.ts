/**
 * Returns the invite-only message shown when someone tries to self-request access in closed beta mode.
 */
export function getClosedBetaRequestAccessMessage(betaAccessContact?: string): string {
  return betaAccessContact
    ? `This beta is invite-only. Contact ${betaAccessContact} for access.`
    : 'This beta is invite-only. Contact the Facilitate team for access.';
}

/**
 * Returns the support guidance shown on the closed-beta sign-in screen.
 */
export function getClosedBetaSupportMessage(betaAccessContact?: string): string {
  return betaAccessContact
    ? `Access is limited to invited testers. Contact ${betaAccessContact} if you need an account or password reset.`
    : 'Access is limited to invited testers. Contact the Facilitate team if you need an account or password reset.';
}
