import { describe, expect, it } from 'vitest';
import { walletConnectErrorMessage, walletNetworkFor } from '../../src/lib/midenWalletNetwork';

describe('walletNetworkFor', () => {
  it('names each network the Miden Wallet knows, mainnet included', () => {
    expect(walletNetworkFor('devnet')).toBe('devnet');
    expect(walletNetworkFor('testnet')).toBe('testnet');
    expect(walletNetworkFor('local')).toBe('localnet');
    // The adapter has no mainnet entry yet; the wallet takes the name as is.
    expect(walletNetworkFor('mainnet')).toBe('mainnet');
  });

  it('refuses a custom network, which the wallet cannot know', () => {
    expect(() => walletNetworkFor('custom')).toThrow(/no custom network/);
  });
});

describe('walletConnectErrorMessage', () => {
  it("turns the wallet's wrong-network refusal into an instruction", () => {
    expect(walletConnectErrorMessage(new Error('NETWORK_NOT_GRANTED'), 'mainnet')).toBe(
      'Your Miden Wallet is not on mainnet. Switch it to mainnet and connect again.',
    );
  });

  it('keeps any other message', () => {
    expect(walletConnectErrorMessage(new Error('User rejected the request'), 'mainnet')).toBe('User rejected the request');
    const unnamed = Object.assign(new Error(''), { name: 'WalletConnectionError' });
    expect(walletConnectErrorMessage(unnamed, 'testnet')).toBe('WalletConnectionError');
  });
});
