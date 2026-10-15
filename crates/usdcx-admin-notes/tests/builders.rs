//! Build + serialization-round-trip tests for the five miden-standards config-note builders
//! (`set_max_supply`, `set_note_fee`, `rbac`, `pause`, `blocklist`), ported to 0.17 in Task 3 of
//! the `usdcx-admin-notes` 0.17 port (see
//! `.superpowers/sdd/2026-09-30-usdcx-admin-notes-0.17-port/task-3-brief.md`).
//!
//! Each test asserts the note builds, is addressed to the faucet as `target` with the given
//! `sender` (target asserted via the note's `NoteTag`), and round-trips through serialization
//! (`Note::to_bytes` / `Note::read_from_bytes`) to an identical `Note`.

use miden_protocol::account::AccountId;
use miden_protocol::asset::FungibleAsset;
use miden_protocol::note::{Note, NoteTag};
use miden_protocol::utils::serde::{Deserializable, Serializable};
use miden_protocol::{Felt, Word};
use miden_standards::note::config::{PauseConfigNote, RbacConfig};

use usdcx_admin_notes::testing::{faucet_and_sender, other_account};

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

/// Asserts the note is addressed correctly (sender / target-tag) and round-trips through
/// serialization to an identical `Note`.
fn assert_well_formed(note: &Note, sender: AccountId, faucet: AccountId) {
    assert_eq!(note.metadata().sender(), sender);
    assert_eq!(note.metadata().tag(), NoteTag::with_account_target(faucet));
    let bytes = note.to_bytes();
    assert_eq!(&Note::read_from_bytes(&bytes).unwrap(), note);
}

#[test]
fn set_max_supply_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::set_max_supply(faucet, sender, 1_000_000, serial(1)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn set_note_fee_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note_script_root = PauseConfigNote::script_root();
    let fee_asset = FungibleAsset::new(faucet, 100).unwrap();
    let note =
        usdcx_admin_notes::set_note_fee(faucet, sender, note_script_root, fee_asset, serial(2))
            .unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn rbac_grant_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let grantee = other_account();
    let config = RbacConfig::GrantRole {
        role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
        account: grantee,
    };
    let note = usdcx_admin_notes::rbac(faucet, sender, config, serial(3)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn rbac_revoke_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let grantee = other_account();
    let config = RbacConfig::RevokeRole {
        role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
        account: grantee,
    };
    let note = usdcx_admin_notes::rbac(faucet, sender, config, serial(4)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn rbac_grant_and_revoke_notes_differ() {
    let (faucet, sender) = faucet_and_sender();
    let grantee = other_account();
    let grant = usdcx_admin_notes::rbac(
        faucet,
        sender,
        RbacConfig::GrantRole {
            role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
            account: grantee,
        },
        serial(11),
    )
    .unwrap();
    let revoke = usdcx_admin_notes::rbac(
        faucet,
        sender,
        RbacConfig::RevokeRole {
            role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
            account: grantee,
        },
        serial(11),
    )
    .unwrap();
    assert_ne!(grant.id(), revoke.id(), "grant and revoke must produce distinct notes");
}

#[test]
fn pause_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::pause(faucet, sender, false, serial(5)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn unpause_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::pause(faucet, sender, true, serial(6)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn pause_and_unpause_notes_differ() {
    let (faucet, sender) = faucet_and_sender();
    let pause = usdcx_admin_notes::pause(faucet, sender, false, serial(7)).unwrap();
    let unpause = usdcx_admin_notes::pause(faucet, sender, true, serial(7)).unwrap();
    assert_ne!(pause.id(), unpause.id(), "pause and unpause must produce distinct notes");
}

#[test]
fn blocklist_block_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let target_account = other_account();
    let note =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, false, serial(8)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn blocklist_unblock_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let target_account = other_account();
    let note =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, true, serial(9)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn blocklist_block_and_unblock_notes_differ() {
    let (faucet, sender) = faucet_and_sender();
    let target_account = other_account();
    let block =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, false, serial(10)).unwrap();
    let unblock =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, true, serial(10)).unwrap();
    assert_ne!(block.id(), unblock.id(), "block and unblock must produce distinct notes");
}

// ---------------------------------------------------------------------------
// Faucet-owned builders (Task 4): set_min_burn, set_attester
// ---------------------------------------------------------------------------

#[test]
fn set_min_burn_rejects_zero() {
    let (faucet, sender) = faucet_and_sender();
    assert!(usdcx_admin_notes::set_min_burn(faucet, sender, 0, serial(12)).is_err());

    let note = usdcx_admin_notes::set_min_burn(faucet, sender, 1, serial(12)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn set_attester_enabled_flag_encodes() {
    let (faucet, sender) = faucet_and_sender();
    let commitment = Word::from([
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
    ]);
    let note =
        usdcx_admin_notes::set_attester(faucet, sender, commitment, true, serial(13)).unwrap();
    assert_well_formed(&note, sender, faucet);
}

#[test]
fn set_attester_enabled_true_and_false_notes_differ() {
    let (faucet, sender) = faucet_and_sender();
    let commitment = Word::from([
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
        Felt::new(7).unwrap(),
    ]);
    let enabled =
        usdcx_admin_notes::set_attester(faucet, sender, commitment, true, serial(14)).unwrap();
    let disabled =
        usdcx_admin_notes::set_attester(faucet, sender, commitment, false, serial(14)).unwrap();
    assert_ne!(enabled.id(), disabled.id(), "enabled and disabled must produce distinct notes");
}

#[test]
fn rbac_set_admin_targets_the_contract_and_round_trips() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let admin = usdcx_admin_notes::role_symbol("FEE_MNGR").unwrap();
    let note =
        usdcx_admin_notes::rbac_set_admin(faucet, sender, role, Some(admin), serial(1)).unwrap();
    assert_well_formed(&note, sender, faucet);
    let grant = usdcx_admin_notes::rbac(
        faucet,
        sender,
        RbacConfig::GrantRole { role: usdcx_admin_notes::role_symbol("PAUSER").unwrap(), account: sender },
        serial(9),
    )
    .unwrap();
    assert_eq!(note.script().root(), grant.script().root());
}

#[test]
fn rbac_set_admin_accepts_none_to_revert_to_admin() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    assert!(usdcx_admin_notes::rbac_set_admin(faucet, sender, role, None, serial(2)).is_ok());
}

#[test]
fn rbac_renounce_targets_the_contract_and_round_trips() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let note = usdcx_admin_notes::rbac_renounce(faucet, sender, role, serial(3)).unwrap();
    assert_well_formed(&note, sender, faucet);
}
