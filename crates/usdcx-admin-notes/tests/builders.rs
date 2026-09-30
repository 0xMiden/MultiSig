//! Build + serialization-round-trip tests for the five miden-standards config-note builders
//! (`set_max_supply`, `set_note_fee`, `rbac`, `pause`, `blocklist`), ported to 0.17 in Task 3 of
//! the `usdcx-admin-notes` 0.17 port (see
//! `.superpowers/sdd/2026-09-30-usdcx-admin-notes-0.17-port/task-3-brief.md`).
//!
//! Each test asserts the note builds, is addressed to the faucet as `target` with the given
//! `sender`, and round-trips through serialization (`Note::to_bytes` / `Note::read_from_bytes`)
//! to an identical `Note`.

use miden_protocol::asset::FungibleAsset;
use miden_protocol::note::Note;
use miden_protocol::utils::serde::{Deserializable, Serializable};
use miden_protocol::{Felt, Word};
use miden_standards::note::config::{PauseConfigNote, RbacConfig};

use usdcx_admin_notes::testing::faucet_and_sender;

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

/// Asserts the note is addressed correctly (sender / target) and round-trips through
/// serialization to an identical `Note`.
fn assert_well_formed(note: &Note, sender: miden_protocol::account::AccountId) {
    assert_eq!(note.metadata().sender(), sender);
    let bytes = note.to_bytes();
    assert_eq!(&Note::read_from_bytes(&bytes).unwrap(), note);
}

#[test]
fn set_max_supply_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::set_max_supply(faucet, sender, 1_000_000, serial(1)).unwrap();
    assert_well_formed(&note, sender);
    assert_eq!(
        note.metadata().tag(),
        miden_protocol::note::NoteTag::with_account_target(faucet)
    );
}

#[test]
fn set_note_fee_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note_script_root = PauseConfigNote::script_root();
    let fee_asset = FungibleAsset::new(faucet, 100).unwrap();
    let note =
        usdcx_admin_notes::set_note_fee(faucet, sender, note_script_root, fee_asset, serial(2))
            .unwrap();
    assert_well_formed(&note, sender);
    assert_eq!(
        note.metadata().tag(),
        miden_protocol::note::NoteTag::with_account_target(faucet)
    );
}

#[test]
fn rbac_grant_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let (_, grantee) = faucet_and_sender();
    let config = RbacConfig::GrantRole {
        role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
        account: grantee,
    };
    let note = usdcx_admin_notes::rbac(faucet, sender, config, serial(3)).unwrap();
    assert_well_formed(&note, sender);
}

#[test]
fn rbac_revoke_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let (_, grantee) = faucet_and_sender();
    let config = RbacConfig::RevokeRole {
        role: usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_UNPAUSER_ROLE).unwrap(),
        account: grantee,
    };
    let note = usdcx_admin_notes::rbac(faucet, sender, config, serial(4)).unwrap();
    assert_well_formed(&note, sender);
}

#[test]
fn pause_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::pause(faucet, sender, false, serial(5)).unwrap();
    assert_well_formed(&note, sender);
}

#[test]
fn unpause_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let note = usdcx_admin_notes::pause(faucet, sender, true, serial(6)).unwrap();
    assert_well_formed(&note, sender);
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
    let (_, target_account) = faucet_and_sender();
    let note =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, false, serial(8)).unwrap();
    assert_well_formed(&note, sender);
}

#[test]
fn blocklist_unblock_builds_targeting_faucet() {
    let (faucet, sender) = faucet_and_sender();
    let (_, target_account) = faucet_and_sender();
    let note =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, true, serial(9)).unwrap();
    assert_well_formed(&note, sender);
}

#[test]
fn blocklist_block_and_unblock_notes_differ() {
    let (faucet, sender) = faucet_and_sender();
    let (_, target_account) = faucet_and_sender();
    let block =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, false, serial(10)).unwrap();
    let unblock =
        usdcx_admin_notes::blocklist(faucet, sender, target_account, true, serial(10)).unwrap();
    assert_ne!(block.id(), unblock.id(), "block and unblock must produce distinct notes");
}
