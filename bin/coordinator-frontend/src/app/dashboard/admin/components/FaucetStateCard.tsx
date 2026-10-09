'use client';

import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { useFaucetConfig } from '@/hooks/useFaucetConfig';
import { groupDigits } from '@/lib/tokenAmounts';

/**
 * A read-only summary of the faucet's current on-chain values (token supply, max supply, min burn,
 * the enabled attester commitments in full),
 * shown at the top of the admin console. Token supply is the floor for `set_max_supply` (the faucet
 * rejects a new max below it), so surfacing it here -- and not only in the form -- gives admins the
 * number they need before they start. All values are base units, grouped in thousands.
 *
 * Renders nothing until the faucet account bytes are ready and the config reads back. A read failure
 * leaves `useFaucetConfig` null, so the card simply does not appear rather than showing wrong values.
 */
export function FaucetStateCard({ faucetBytesState }: { faucetBytesState: FaucetBytesState }) {
  const config = useFaucetConfig(faucetBytesState);
  if (!config) return null;

  const items: { label: string; value: string }[] = [
    { label: 'Token supply', value: groupDigits(config.tokenSupply) },
    { label: 'Max supply', value: groupDigits(config.maxSupply) },
    { label: 'Min burn', value: groupDigits(config.minBurn) },
  ];

  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
      <div className="text-[14px] font-[600] text-[#111] mb-0.5">Faucet state</div>
      <div className="text-[12px] text-[rgba(0,0,0,0.5)] mb-3">Current on-chain values (base units).</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
            <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)]">{item.label}</div>
            <div className="text-[14px] font-[600] text-[#111] mt-0.5 font-mono break-all">{item.value}</div>
          </div>
        ))}
      </div>
      {/* The attester allowlist: every enabled commitment in full, since admins compare these
          against the attester keys they expect -- a count alone cannot be checked. */}
      <div className="mt-3 rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
        <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)]">
          Enabled attesters ({config.attesters.length})
        </div>
        {config.attesters.length === 0 ? (
          <div className="text-[13px] font-[500] text-[#111] mt-0.5">none</div>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {config.attesters.map((commitment) => (
              <li key={commitment} className="text-[13px] font-[600] text-[#111] font-mono break-all">
                {commitment}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
