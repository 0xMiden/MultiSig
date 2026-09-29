import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Word } from '@miden-sdk/miden-sdk';
import loadWasm from '../../../node_modules/@miden-sdk/miden-sdk/dist/st/wasm.js';
import { useLedgerSession } from '../../../src/hooks/useLedgerSession';
import { LedgerPanel } from '../../../src/components/LedgerPanel';
import { controls } from './device';
await loadWasm();
function App() {
  const ledger = useLedgerSession();
  const [result, setResult] = useState('');
  const kept = useRef<typeof ledger.signer>(null);
  const sign = async (signer: NonNullable<typeof ledger.signer>) => {
    try {setResult(await signer.signCommitment(new Word(new BigUint64Array([1n,2n,3n,4n])).toHex()));}
    catch (error) {setResult(String(error));}
  };
  return <>
    <button onClick={ledger.show}>Connect</button>
    <button onClick={ledger.disconnect}>Disconnect</button>
    <button onClick={() => controls.unplug()}>Unplug</button>
    <label><input type="checkbox" onChange={e => {controls.reject=e.target.checked;}}/>Reject on device</label>
    <output data-testid="identity">{ledger.signer?.commitment ?? 'Disconnected'}</output>
    <output data-testid="path">{ledger.selected?.path}</output>
    <button disabled={!ledger.signer} onClick={() => void sign(ledger.signer!)}>Sign summary</button>
    <button onClick={() => { kept.current = ledger.signer; }}>Keep signer</button>
    <button onClick={() => { if (kept.current) void sign(kept.current); }}>Sign with kept signer</button>
    <output data-testid="signature">{result}</output>
    <LedgerPanel ledger={ledger}/>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
