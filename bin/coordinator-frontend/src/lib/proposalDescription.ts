/** The difference between the account's signers now and after a signer proposal. */
export interface SignerChange {
  added: string[];
  removed: string[];
  thresholdBefore: number;
  thresholdAfter: number;
  signersBefore: number;
  signersAfter: number;
}

const norm = (c: string) => c.trim().toLowerCase();

export function describeSignerChange(
  currentSigners: readonly string[],
  currentThreshold: number,
  targetSigners: readonly string[],
  targetThreshold: number,
): SignerChange {
  const before = new Set(currentSigners.map(norm));
  const after = new Set(targetSigners.map(norm));
  return {
    added: targetSigners.filter((c) => !before.has(norm(c))),
    removed: currentSigners.filter((c) => !after.has(norm(c))),
    thresholdBefore: currentThreshold,
    thresholdAfter: targetThreshold,
    signersBefore: currentSigners.length,
    signersAfter: targetSigners.length,
  };
}

export function shortHex(value: string, head = 8, tail = 4): string {
  const v = value.trim();
  return v.length > head + tail + 1 ? `${v.slice(0, head)}…${v.slice(-tail)}` : v;
}
