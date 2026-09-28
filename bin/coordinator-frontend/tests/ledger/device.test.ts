import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
const mocks = vi.hoisted(() => ({
  dmk: { startDiscovering: vi.fn(), stopDiscovering: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), close: vi.fn(), getDeviceSessionState: vi.fn() },
  eth: { getAddress: vi.fn(), signTypedData: vi.fn() }, context: vi.fn(), cancel: vi.fn(),
}));
vi.mock('@ledgerhq/device-management-kit', () => ({
  DeviceActionStatus: {Completed:'completed', Error:'error', Stopped:'stopped', Pending:'pending'},
  DeviceStatus: {NOT_CONNECTED:'disconnected'},
  DeviceManagementKitBuilder: class {addTransport(){return this;} build(){return mocks.dmk;}},
}));
vi.mock('@ledgerhq/device-transport-kit-web-hid', () => ({webHidTransportFactory: {}}));
vi.mock('@ledgerhq/device-signer-kit-ethereum', () => ({
  SignerEthBuilder: class {withContextModule(context: unknown){mocks.context(context);return this;} build(){return mocks.eth;}},
}));
import {createLedgerConnection, ledgerSupported} from '../../src/lib/ledger/device';
const path="44'/60'/0'/0/0";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', {hid:{}}); vi.stubGlobal('window', {isSecureContext:true});
  mocks.dmk.startDiscovering.mockReturnValue(of({id:'test'}));
  mocks.dmk.connect.mockResolvedValue('session');
  mocks.dmk.getDeviceSessionState.mockReturnValue(new Subject());
});
afterEach(() => {vi.unstubAllGlobals();vi.useRealTimers();});
describe('USB lifecycle', () => {
  it('requires WebHID in a secure context', () => {
    expect(ledgerSupported()).toBe(true);
    vi.stubGlobal('navigator', {}); expect(ledgerSupported()).toBe(false);
  });
  it('uses on-device confirmation and supplies a context with no remote calls', async () => {
    const connection=createLedgerConnection(vi.fn(),vi.fn());
    const device=await connection.connect();
    mocks.eth.getAddress.mockReturnValue({observable:of({status:'completed',output:{address:'0x123',publicKey:'04ab'}}),cancel:mocks.cancel});
    expect(await device.getAddress(path,true)).toEqual({address:'0x123',publicKey:'04ab',path});
    expect(mocks.eth.getAddress).toHaveBeenCalledWith(path,{checkOnDevice:true});
    const context=mocks.context.mock.calls[0][0];
    expect(await context.getContexts()).toEqual([]);
    expect((await context.getTypedDataFilters()).type).toBe('error');
    await connection.disconnect();
    expect(mocks.dmk.close).toHaveBeenCalledOnce();
  });
  it('cancellation settles a pending action and frees the device', async () => {
    const connection=createLedgerConnection(vi.fn(),vi.fn());const device=await connection.connect();
    mocks.eth.getAddress.mockReturnValue({observable:new Subject(),cancel:mocks.cancel});
    const pending=device.getAddress(path,true);
    const assertion=expect(pending).rejects.toThrow('cancelled');
    await connection.disconnect(); await assertion;
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.dmk.disconnect).toHaveBeenCalledWith({sessionId:'session'});
  });
  it('times out a device which never replies', async () => {
    vi.useFakeTimers();
    const connection=createLedgerConnection(vi.fn(),vi.fn());const device=await connection.connect();
    mocks.eth.getAddress.mockReturnValue({observable:new Subject(),cancel:mocks.cancel});
    const assertion=expect(device.getAddress(path,true)).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(180_000); await assertion;
    await connection.disconnect();
  });
  it('propagates rejection and unexpected observable completion', async () => {
    const connection=createLedgerConnection(vi.fn(),vi.fn());const device=await connection.connect();
    mocks.eth.getAddress.mockReturnValueOnce({observable:of({status:'error',error:new Error('User rejected')}),cancel:mocks.cancel});
    await expect(device.getAddress(path,true)).rejects.toThrow('User rejected');
    mocks.eth.getAddress.mockReturnValueOnce({observable:of(),cancel:mocks.cancel});
    await expect(device.getAddress(path,true)).rejects.toThrow('without a result');
    await connection.disconnect();
  });
});
