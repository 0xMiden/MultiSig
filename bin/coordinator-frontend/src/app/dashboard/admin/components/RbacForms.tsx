'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, textInputClass, selectClass } from './fields';
import { normalizeAccountId, ValidationError } from '@/lib/admin/validation';
import { getAdminConfig } from '@/config/adminConfig';
import { ROLES } from '@/lib/admin/roles';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
}

function RoleSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">Select role…</option>
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

/** ADMIN-gated: grant an RBAC role to an account. */
export function RbacGrantForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [role, setRole] = useState('');
  const [accountId, setAccountId] = useState('');
  const cfg = getAdminConfig();

  return (
    <AdminActionCard
      action="rbac_grant"
      title="Grant role"
      description="Grants an RBAC role to an account on this faucet."
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_grant', role, accountId: normalizeAccountId(accountId, cfg.networkId) };
      }}
      onSubmitted={() => {
        setRole('');
        setAccountId('');
      }}
    >
      <Field label="Role">
        <RoleSelect value={role} onChange={setRole} />
      </Field>
      <Field label="Target account ID">
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="0x…"
          className={textInputClass}
        />
      </Field>
    </AdminActionCard>
  );
}

/** ADMIN-gated: revoke an RBAC role from an account. */
export function RbacRevokeForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [role, setRole] = useState('');
  const [accountId, setAccountId] = useState('');
  const cfg = getAdminConfig();

  return (
    <AdminActionCard
      action="rbac_revoke"
      title="Revoke role"
      description="Revokes an RBAC role from an account on this faucet."
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_revoke', role, accountId: normalizeAccountId(accountId, cfg.networkId) };
      }}
      onSubmitted={() => {
        setRole('');
        setAccountId('');
      }}
    >
      <Field label="Role">
        <RoleSelect value={role} onChange={setRole} />
      </Field>
      <Field label="Target account ID">
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="0x…"
          className={textInputClass}
        />
      </Field>
    </AdminActionCard>
  );
}
