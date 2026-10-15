'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, AccountIdField, selectClass } from './fields';
import { normalizeAccountId, ValidationError } from '@/lib/admin/validation';
import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { actionInfo } from '@/lib/admin/roles';
import type { RoleSpec } from '@/lib/admin/target';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { ActionSender } from '@/lib/admin/directAction';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
  /** Who sends the action: the acting multisig (a proposal) or the connected Bread account. */
  sender?: ActionSender;
}

function RoleSelect({ roles, value, onChange }: { roles: readonly RoleSpec[]; value: string; onChange: (next: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">Select role…</option>
      {roles.map((r) => (
        <option key={r.symbol} value={r.symbol}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/** ADMIN-gated: grant an RBAC role to an account. */
export function RbacGrantForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const [role, setRole] = useState('');
  const [accountId, setAccountId] = useState('');

  return (
    <AdminActionCard
      action="rbac_grant"
      title={actionInfo(target, 'rbac_grant').title}
      description={actionInfo(target, 'rbac_grant').description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_grant', role, accountId: normalizeAccountId(accountId, target.networkId) };
      }}
      onSubmitted={() => {
        setRole('');
        setAccountId('');
      }}
    >
      <Field label="Role">
        <RoleSelect roles={target.roles} value={role} onChange={setRole} />
      </Field>
      <AccountIdField label="Target account ID" value={accountId} onChange={setAccountId} networkId={target.networkId} />
    </AdminActionCard>
  );
}

/** ADMIN-gated: revoke an RBAC role from an account. */
export function RbacRevokeForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const [role, setRole] = useState('');
  const [accountId, setAccountId] = useState('');

  return (
    <AdminActionCard
      action="rbac_revoke"
      title={actionInfo(target, 'rbac_revoke').title}
      description={actionInfo(target, 'rbac_revoke').description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_revoke', role, accountId: normalizeAccountId(accountId, target.networkId) };
      }}
      onSubmitted={() => {
        setRole('');
        setAccountId('');
      }}
    >
      <Field label="Role">
        <RoleSelect roles={target.roles} value={role} onChange={setRole} />
      </Field>
      <AccountIdField label="Target account ID" value={accountId} onChange={setAccountId} networkId={target.networkId} />
    </AdminActionCard>
  );
}

/** ADMIN-gated: change which role administers `role`. */
export function RbacSetAdminForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const [role, setRole] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const info = actionInfo(target, 'rbac_set_admin');

  return (
    <AdminActionCard
      action="rbac_set_admin"
      title={info.title}
      description={info.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_set_admin', role, adminRole: adminRole || null };
      }}
      onSubmitted={() => {
        setRole('');
        setAdminRole('');
      }}
    >
      {/* The root role is not offered for re-parenting; `decideSetRoleAdmin` blocks it regardless. */}
      <Field label="Role">
        <RoleSelect roles={target.roles.filter((r) => r.symbol !== 'ADMIN')} value={role} onChange={setRole} />
      </Field>
      <Field label="Admin role (empty = default root admin)">
        <RoleSelect roles={target.roles} value={adminRole} onChange={setAdminRole} />
      </Field>
    </AdminActionCard>
  );
}

/** Open to any role holder: give up a role the sender holds. The select lists only those. */
export function RbacRenounceForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const flags = sender === 'bread' ? active!.breadRoles : active!.roles;
  const held = target.roles.filter((r) => flags?.[r.symbol]);
  const [role, setRole] = useState('');
  const info = actionInfo(target, 'rbac_renounce');

  return (
    <AdminActionCard
      action="rbac_renounce"
      title={info.title}
      description={info.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role you hold');
        return { action: 'rbac_renounce', role };
      }}
      onSubmitted={() => setRole('')}
      submitLabel="Renounce"
    >
      <Field label="Role to renounce">
        <RoleSelect roles={held} value={role} onChange={setRole} />
      </Field>
    </AdminActionCard>
  );
}
