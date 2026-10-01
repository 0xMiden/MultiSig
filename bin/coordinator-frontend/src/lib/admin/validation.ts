import { AccountId, Word } from '@miden-sdk/miden-sdk';

const U64_MAX = (1n << 64n) - 1n;

// Map network ID names to their bech32 HRP (Human-Readable Part) prefixes
const NETWORK_ID_TO_HRP: Record<string, string> = {
  devnet: 'mdev',
  testnet: 'mtst',
  mainnet: 'mm',
};

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

function parseWord(input: string, label: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase().startsWith('0x')
    ? trimmed.toLowerCase().slice(2)
    : trimmed.toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new ValidationError(`${label} must be exactly 64 hex characters`);
  }

  // Cross-check with Word.fromHex to ensure field elements don't exceed modulus
  try {
    Word.fromHex(`0x${normalized}`);
  } catch {
    throw new ValidationError(`Invalid ${label}: field elements exceed modulus`);
  }

  return `0x${normalized}`;
}

export function parseWordHex(input: string): string {
  return parseWord(input, 'Word');
}

export function parseNoteScriptRoot(input: string): string {
  return parseWord(input, 'NoteScriptRoot');
}

export function normalizeAccountId(input: string, networkId: string): string {
  const trimmed = input.trim();

  // Try AccountId.fromHex first
  try {
    const accountId = AccountId.fromHex(trimmed);
    const result = accountId.toString();
    accountId.free();
    return result;
  } catch {
    // Try AccountId.fromBech32 (convert to lowercase first for case-insensitive handling)
    try {
      const lowerTrimmed = trimmed.toLowerCase();
      const accountId = AccountId.fromBech32(lowerTrimmed);
      // Validate network ID matches
      validateBech32Network(lowerTrimmed, networkId);
      const result = accountId.toString();
      accountId.free();
      return result;
    } catch (e) {
      if (e instanceof ValidationError) {
        throw e;
      }
      throw new ValidationError('Invalid account ID format');
    }
  }
}

/**
 * Validate that a bech32-encoded account ID's network matches the expected network.
 * Extracts the HRP from the bech32 string and compares it to the expected HRP for the given network.
 */
function validateBech32Network(bech32: string, networkId: string): void {
  const expectedHrp = NETWORK_ID_TO_HRP[networkId];
  if (!expectedHrp) {
    throw new ValidationError(`Unknown network: ${networkId}`);
  }

  // Lowercase the bech32 input for case-insensitive comparison
  const lowerBech32 = bech32.toLowerCase();
  // Extract HRP: everything before the first '1' (bech32 separator)
  const separatorIndex = lowerBech32.indexOf('1');
  if (separatorIndex === -1) {
    throw new ValidationError('Invalid bech32 format');
  }

  const hrp = lowerBech32.slice(0, separatorIndex);
  if (hrp !== expectedHrp) {
    throw new ValidationError(`Account ID is on network ${hrp}, expected ${expectedHrp}`);
  }
}
