import { AccountId, Word } from '@miden-sdk/miden-sdk';

const U64_MAX = (1n << 64n) - 1n;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseU64(input: string): bigint {
  const trimmed = input.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new ValidationError('Enter a whole number');
  }
  const v = BigInt(trimmed);
  if (v > U64_MAX) {
    throw new ValidationError('Value must fit in a u64');
  }
  return v;
}

export function parseMinBurn(input: string): bigint {
  const v = parseU64(input);
  if (v < 1n) {
    throw new ValidationError('Burn amount must be at least 1');
  }
  return v;
}

export function parseWordHex(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase().startsWith('0x')
    ? trimmed.toLowerCase().slice(2)
    : trimmed.toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new ValidationError('Word must be exactly 64 hex characters');
  }

  // Cross-check with Word.fromHex to ensure field elements don't exceed modulus
  try {
    Word.fromHex(`0x${normalized}`);
  } catch {
    throw new ValidationError('Invalid Word: field elements exceed modulus');
  }

  return `0x${normalized}`;
}

export function parseNoteScriptRoot(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase().startsWith('0x')
    ? trimmed.toLowerCase().slice(2)
    : trimmed.toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new ValidationError('NoteScriptRoot must be exactly 64 hex characters');
  }

  // Cross-check with Word.fromHex to ensure field elements don't exceed modulus
  try {
    Word.fromHex(`0x${normalized}`);
  } catch {
    throw new ValidationError('Invalid NoteScriptRoot: field elements exceed modulus');
  }

  return `0x${normalized}`;
}

export function normalizeAccountId(input: string, networkId: string): string {
  const trimmed = input.trim();

  // Try AccountId.fromHex first
  try {
    const accountId = AccountId.fromHex(trimmed);
    return accountId.toString();
  } catch {
    // Try AccountId.fromBech32
    try {
      const accountId = AccountId.fromBech32(trimmed);
      // Check that the network ID matches
      const bech32Network = extractNetworkFromBech32(trimmed);
      if (bech32Network && bech32Network !== networkId) {
        throw new ValidationError(`Account ID network (${bech32Network}) does not match expected network (${networkId})`);
      }
      return accountId.toString();
    } catch (e) {
      if (e instanceof ValidationError) {
        throw e;
      }
      throw new ValidationError('Invalid account ID format');
    }
  }
}

/**
 * Extract the network identifier from a bech32-encoded account ID.
 * The format is typically: network<separator>rest
 * For devnet it would be: devnet1... or similar
 */
function extractNetworkFromBech32(bech32: string): string | null {
  const match = bech32.match(/^([a-z]+)\d/);
  return match ? match[1] : null;
}
