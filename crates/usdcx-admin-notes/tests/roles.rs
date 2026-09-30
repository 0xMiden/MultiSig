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
