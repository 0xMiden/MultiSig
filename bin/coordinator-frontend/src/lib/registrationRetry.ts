export interface RegistrationRetrySteps {
  /** Registers the account on Guardian (the call a signer may reject). */
  register(): Promise<void>;
  /** False when the signer changed while registering (e.g. another Ledger address). */
  sessionUnchanged(): boolean;
  registerNoteTag(): Promise<void>;
  requestFunding(): Promise<void>;
  sync(): Promise<void>;
}

export interface RegistrationRetryResult {
  /** Guardian now has the account: the "registration required" flag may be cleared. */
  registered: boolean;
  /** The failure to report, if any step after (or including) registration failed. */
  error: unknown | null;
}

/**
 * One retry of a failed Guardian registration. Registration counts only if
 * Guardian accepted it with the same signer session; until then the account
 * stays "registration required" so the retry remains offered. Funding is
 * best-effort (it has its own retry); tag registration and sync failures are
 * reported but do not undo a successful registration.
 */
export async function runRegistrationRetry(steps: RegistrationRetrySteps): Promise<RegistrationRetryResult> {
  try {
    await steps.register();
  } catch (error) {
    return { registered: false, error };
  }
  if (!steps.sessionUnchanged()) {
    return { registered: false, error: new Error('Ledger session changed; load the account again.') };
  }
  try {
    await steps.registerNoteTag();
    try {
      await steps.requestFunding();
    } catch {
      // Funding failures are shown separately and can be retried.
    }
    await steps.sync();
    return { registered: true, error: null };
  } catch (error) {
    return { registered: true, error };
  }
}
