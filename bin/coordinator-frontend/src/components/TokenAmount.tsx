'use client';

import { useTokenInfo } from '@/hooks/useTokenInfo';
import { formatTokenAmount, shortFaucetId } from '@/lib/tokenAmounts';

/**
 * An amount of one token, in that token's own decimals and symbol. When the
 * token cannot be read it shows raw base units and the faucet id: never a
 * guessed scale or a well-known name, so an unknown token cannot pose as one.
 */
export function TokenAmount({ faucetId, amount, className }: {
  faucetId: string;
  amount: bigint | string;
  className?: string;
}) {
  const token = useTokenInfo(faucetId);
  if (token.status === 'ready') {
    return <span className={className}>{formatTokenAmount(amount, token.info.decimals)} {token.info.symbol}</span>;
  }
  if (token.status === 'error') {
    return (
      <span className={className} title={token.error}>
        {BigInt(amount).toString()} base units of {shortFaucetId(faucetId)}
      </span>
    );
  }
  return <span className={className}>…</span>;
}

/** Just the symbol (or the short faucet id while unknown). */
export function TokenSymbol({ faucetId, className }: { faucetId: string; className?: string }) {
  const token = useTokenInfo(faucetId);
  return <span className={className}>{token.status === 'ready' ? token.info.symbol : shortFaucetId(faucetId)}</span>;
}
