import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { verifyTypedData } from 'viem';
import { Eip712Signer } from '@openzeppelin/miden-multisig-client';
import { PublicKey, Word, TestUtils } from '@miden-sdk/miden-sdk';
import { GuardianHttpClient, RequestAuthPayload } from '@openzeppelin/guardian-client';
import { DirectLedgerAdapter, encodeLedgerSignature, ledgerPath, type LedgerDevice } from '../../src/lib/ledger/adapter';

// Disposable deterministic test key. viem independently constructs the signing digest.
const account = privateKeyToAccount(`0x${'07'.repeat(32)}`);
const other = privateKeyToAccount(`0x${'08'.repeat(32)}`);
const selected = { address: account.address, publicKey: account.publicKey, path: ledgerPath('ledger-live', 2) };
function deviceFor(wallet = account): LedgerDevice {
  return {
    getAddress: vi.fn(async () => selected),
    signTypedData: vi.fn(async (_path, data) => {
      const signature = await wallet.signTypedData(data as Parameters<typeof wallet.signTypedData>[0]);
      return { r: signature.slice(0, 66), s: `0x${signature.slice(66, 130)}`, v: parseInt(signature.slice(130), 16) };
    }),
    cancel: vi.fn(), disconnect: vi.fn(async () => {}),
  };
}
const commitment = new Word(new BigUint64Array([1n, 2n, 3n, 4n])).toHex();

describe('direct Ledger → real Guardian signer → Miden WASM', () => {
  it('derives the real commitment and signs with the selected path', async () => {
    const device = deviceFor();
    const signer = new Eip712Signer(new DirectLedgerAdapter(device, selected), selected.publicKey, selected.address);
    const keyBytes = Uint8Array.from(signer.publicKey.slice(2).match(/../g)!, value => parseInt(value, 16));
    const pk = PublicKey.deserialize(new Uint8Array([1, ...keyBytes]));
    expect(signer.commitment).toBe(pk.toCommitment().toHex());
    pk.free();
    const signature = await signer.signCommitment(commitment);
    const [path, data] = vi.mocked(device.signTypedData).mock.calls[0];
    expect(path).toBe(selected.path);
    expect(data.domain).toEqual({ name: 'Miden Transaction', version: '1' });
    expect(data.primaryType).toBe('MidenTransaction');
    expect(data.message.txSummaryHash).toBe(commitment);
    expect(await verifyTypedData({ ...data, domain: {name: data.domain.name, version: data.domain.version}, address: account.address, signature: signature as `0x${string}` })).toBe(true);
    expect(signer.proposalMessageFormat).toBe('eip712');
  });

  it('uses distinct real digests for request authentication and lookup', async () => {
    const device = deviceFor();
    const signer = new Eip712Signer(new DirectLedgerAdapter(device, selected), selected.publicKey, selected.address);
    const mockId = TestUtils.createMockAccountId();
    const id = mockId.toString();
    mockId.free();
    const payload = RequestAuthPayload.fromRequest({ action: 'read' });
    const a = await signer.signRequest(id, 1700000000, payload);
    const b = await signer.signRequest(id, 1700000001, payload);
    const c = await signer.signRequest(id, 1700000000, RequestAuthPayload.fromRequest({ action: 'write' }));
    const lookup = await signer.signLookupMessage(signer.commitment, 1700000000000);
    expect(new Set([a, b, c, lookup]).size).toBe(4);
    expect(vi.mocked(device.signTypedData).mock.calls.map(([, data]) => data.primaryType))
      .toEqual(['GuardianRequest', 'GuardianRequest', 'GuardianRequest', 'GuardianLookup']);
  });

  it('routes Guardian state-sync authentication to Ledger and fails closed after disconnect', async () => {
    const device = deviceFor();
    const bridge = new DirectLedgerAdapter(device, selected);
    const signer = new Eip712Signer(bridge, selected.publicKey, selected.address);
    const guardian = new GuardianHttpClient('https://guardian.test');
    guardian.setSigner(signer);
    const mockId = TestUtils.createMockAccountId();
    const id = mockId.toString();
    mockId.free();
    // Only HTTP is stubbed; the real Guardian client constructs and signs the request.
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(guardian.getState(id)).rejects.toThrow();
      expect(device.signTypedData).toHaveBeenCalledTimes(1);
      const [path, data] = vi.mocked(device.signTypedData).mock.calls[0];
      expect(path).toBe(selected.path);
      expect(data.primaryType).toBe('GuardianRequest');
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/state?'), expect.objectContaining({
        headers: expect.objectContaining({ 'x-pubkey': signer.publicKey, 'x-signature': expect.stringMatching(/^0x[\da-f]{130}$/) }),
      }));
      bridge.invalidate();
      await expect(guardian.getState(id)).rejects.toThrow('session changed');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(device.signTypedData).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('rejects a device signing with a different key', async () => {
    const signer = new Eip712Signer(new DirectLedgerAdapter(deviceFor(other), selected), selected.publicKey, selected.address);
    await expect(signer.signCommitment(commitment)).rejects.toThrow('different key');
  });

  it('rejects a mismatched address before contacting the device', () => {
    const device = deviceFor();
    expect(() => new Eip712Signer(new DirectLedgerAdapter(device, selected), selected.publicKey, other.address)).toThrow('does not match');
    expect(device.signTypedData).not.toHaveBeenCalled();
  });

  it('serializes prompts and invalidates active and queued operations', async () => {
    const device = deviceFor();
    let release!: () => void;
    // The held prompt resolves with a signature that is valid for the selected
    // key, so only the adapter's post-sign session check can reject it.
    vi.mocked(device.signTypedData).mockImplementationOnce((path, data) =>
      new Promise(resolve => { release = () => resolve(deviceFor().signTypedData(path, data)); }));
    const bridge = new DirectLedgerAdapter(device, selected);
    const signer = new Eip712Signer(bridge, selected.publicKey, selected.address);
    const first = signer.signCommitment(commitment);
    const second = signer.signCommitment(commitment);
    const settled = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(device.signTypedData).toHaveBeenCalledTimes(1));
    bridge.invalidate();
    expect(device.cancel).toHaveBeenCalledTimes(1);
    release();
    const [active, queued] = await settled;
    expect(active).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('Ledger session changed during signing') } });
    expect(queued).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('Ledger session changed. Load the account again.') } });
    expect(device.signTypedData).toHaveBeenCalledTimes(1);
    await expect(signer.signCommitment(commitment)).rejects.toThrow('session changed');
  });

  describe('stale authentication guard', () => {
    // A request-auth signature carries a timestamp taken before it was queued;
    // one that waited behind a slow prompt for over 30 s must not be signed.
    async function queueBehindSlowPrompt(waitMs: number, queued: (signer: Eip712Signer) => Promise<unknown>) {
      vi.useFakeTimers({ toFake: ['Date'] });
      const device = deviceFor();
      let release!: () => void;
      vi.mocked(device.signTypedData).mockImplementationOnce((path, data) =>
        new Promise(resolve => { release = () => resolve(deviceFor().signTypedData(path, data)); }));
      const signer = new Eip712Signer(new DirectLedgerAdapter(device, selected), selected.publicKey, selected.address);
      const slow = signer.signCommitment(commitment);
      await vi.waitFor(() => expect(device.signTypedData).toHaveBeenCalledTimes(1));
      const next = queued(signer);
      vi.setSystemTime(Date.now() + waitMs);
      release();
      await slow;
      return { next: await Promise.allSettled([next]).then(([r]) => r), device };
    }
    const mockAccount = () => { const id = TestUtils.createMockAccountId(); const s = id.toString(); id.free(); return s; };

    it('refuses a Guardian request that waited more than 30 s', async () => {
      try {
        const { next, device } = await queueBehindSlowPrompt(30_001, signer =>
          signer.signRequest(mockAccount(), Math.floor(Date.now() / 1000), RequestAuthPayload.fromRequest({ action: 'read' })));
        expect(next).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('waited too long') } });
        expect(device.signTypedData).toHaveBeenCalledTimes(1);
      } finally { vi.useRealTimers(); }
    });

    it('still signs a Guardian request queued for under 30 s', async () => {
      try {
        const { next } = await queueBehindSlowPrompt(29_000, signer =>
          signer.signRequest(mockAccount(), Math.floor(Date.now() / 1000), RequestAuthPayload.fromRequest({ action: 'read' })));
        expect(next.status).toBe('fulfilled');
      } finally { vi.useRealTimers(); }
    });

    it('exempts transaction summaries, which carry no timestamp', async () => {
      try {
        const { next } = await queueBehindSlowPrompt(120_000, signer => signer.signCommitment(commitment));
        expect(next.status).toBe('fulfilled');
      } finally { vi.useRealTimers(); }
    });
  });

  it('propagates rejection and permits a deliberate retry', async () => {
    const device = deviceFor();
    vi.mocked(device.signTypedData).mockRejectedValueOnce(new Error('User rejected'));
    const signer = new Eip712Signer(new DirectLedgerAdapter(device, selected), selected.publicKey, selected.address);
    await expect(signer.signCommitment(commitment)).rejects.toThrow('User rejected');
    await expect(signer.signCommitment(commitment)).resolves.toMatch(/^0x[\da-f]{130}$/);
  });

  it('rejects unsupported methods and altered domains before signing', async () => {
    const device = deviceFor(); const bridge = new DirectLedgerAdapter(device, selected);
    await expect(bridge.request({ method: 'personal_sign', params: [] })).rejects.toThrow('Unsupported');
    await expect(bridge.request({ method: 'eth_signTypedData_v4', params: [other.address, '{}'] })).rejects.toThrow('address');
    await expect(bridge.request({ method: 'eth_signTypedData_v4', params: [account.address, JSON.stringify({ primaryType: 'MidenTransaction', domain: { name: 'Other' } })] })).rejects.toThrow('schema');
    expect(device.signTypedData).not.toHaveBeenCalled();
  });
});

describe('device boundary', () => {
  it.each([0, 1, 27, 28])('normalizes recovery ID %i', v => {
    expect(encodeLedgerSignature({ r: `0x${'11'.repeat(32)}`, s: `0x${'22'.repeat(32)}`, v }).slice(-2))
      .toBe((v >= 27 ? v - 27 : v).toString().padStart(2, '0'));
  });
  it('rejects malformed signatures and account indices', () => {
    expect(() => encodeLedgerSignature({ r: '0x11', s: '0x22', v: 27 })).toThrow('coordinates');
    expect(() => encodeLedgerSignature({ r: `0x${'11'.repeat(32)}`, s: `0x${'22'.repeat(32)}`, v: 35 })).toThrow('recovery');
    expect(() => ledgerPath('ledger-live', -1)).toThrow('index');
    expect(ledgerPath('ledger-live', 2)).toBe("44'/60'/2'/0/0");
    expect(ledgerPath('legacy', 2)).toBe("44'/60'/0'/0/2");
  });
});
