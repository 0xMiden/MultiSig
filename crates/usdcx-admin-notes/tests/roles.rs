//! `account_has_role` against a real 0.17 RBAC-seeded USDCx faucet account.
//!
//! See `crates/usdcx-admin-notes/.superpowers/sdd/.../task-2-brief.md` (Task 2 of the 0.17 port):
//! this exercises `usdcx_admin_notes::account_has_role` and `admin_role` against a faucet built by
//! upstream `xusdc-encoding`'s `XReserveStablecoinBuilder` (via its `build_faucet_account` entry
//! point), with `ADMIN` granted to a `holder` account at composition time.

#[test]
fn account_has_role_true_when_member() {
    let (faucet, holder, other) = usdcx_admin_notes::testing::faucet_with_admin();
    assert!(usdcx_admin_notes::account_has_role(
        &faucet,
        holder,
        &usdcx_admin_notes::admin_role()
    ));
    assert!(!usdcx_admin_notes::account_has_role(
        &faucet,
        other,
        &usdcx_admin_notes::admin_role()
    ));
}

/// [`usdcx_admin_notes::rbac_role_members`] must enumerate ALL current `ADMIN` holders by scanning
/// the RBAC role-membership map, not just report a single genesis owner (what
/// [`usdcx_admin_notes::account_has_role`] can tell you one account at a time). This is the
/// primitive the frontend's mandatory "last-ADMIN" guardrail counts on.
#[test]
fn rbac_role_members_lists_admins() {
    let (faucet, admin_a, admin_b) = usdcx_admin_notes::testing::faucet_with_two_admins();
    let members = usdcx_admin_notes::rbac_role_members(&faucet, &usdcx_admin_notes::admin_role());
    let ids: std::collections::HashSet<_> = members.iter().map(|id| id.to_hex()).collect();
    assert!(ids.contains(&admin_a.to_hex()));
    assert!(ids.contains(&admin_b.to_hex()));
    assert_eq!(ids.len(), 2);
}
