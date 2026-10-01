import type { AdminRecipe } from '@/lib/admin/recipe';

/** A human-readable description of an admin recipe's effect. */
export interface AdminRecipeDescription {
  title: string;
  lines: string[];
}

/**
 * Renders an `AdminRecipe` into a title + detail lines, for display to
 * co-signers who only otherwise see the signed transaction summary hash.
 * Amounts are left as the raw decimal strings carried by the recipe — this
 * stays pure/testable and leaves token-decimal formatting to the component
 * (which has access to `useFaucetDecimals`).
 */
export function describeAdminRecipe(recipe: AdminRecipe): AdminRecipeDescription {
  const args = recipe.actionArgs;
  switch (args.action) {
    case 'set_max_supply':
      return { title: 'Set max supply', lines: [`New max supply: ${args.maxSupply}`] };
    case 'set_min_burn':
      return { title: 'Set min burn', lines: [`New min burn: ${args.minBurn}`] };
    case 'set_note_fee':
      return {
        title: 'Set note fee',
        lines: [
          `Note script root: ${args.noteScriptRoot}`,
          `Fee faucet: ${recipe.feeFaucetId} (native, read-only)`,
          `Fee amount: ${args.feeAmount}`,
        ],
      };
    case 'rbac_grant':
      return { title: 'Grant role', lines: [`Role: ${args.role}`, `Target: ${args.accountId}`] };
    case 'rbac_revoke':
      return { title: 'Revoke role', lines: [`Role: ${args.role}`, `Target: ${args.accountId}`] };
    case 'set_attester':
      return {
        title: 'Set attester',
        lines: [`Commitment: ${args.commitment}`, `Enabled: ${args.enabled ? 'yes' : 'no'}`],
      };
    case 'pause':
      return { title: 'Pause USDCx', lines: [] };
    case 'unpause':
      return { title: 'Unpause USDCx', lines: [] };
    case 'blocklist':
      return {
        title: args.blocked ? 'Block account' : 'Unblock account',
        lines: [`Target: ${args.accountId}`],
      };
    default: {
      const exhaustive: never = args;
      throw new Error(`Unknown admin action: ${JSON.stringify(exhaustive)}`);
    }
  }
}
