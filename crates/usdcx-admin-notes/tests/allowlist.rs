//! Every admin note this crate builds must carry a script the USDCx faucet admits.
//!
//! The faucet is a network account: the node only consumes a note for it when the note's script
//! root is a key of the faucet's `allowed_note_scripts` map, which `miden-usdcx` fills from
//! `XReserveStablecoinBuilder::allowed_note_scripts()` at genesis. A note outside that set is
//! committed and then never consumed, with no error on the client side. Script roots change with
//! the protocol version, so this also has to hold again after every dependency bump.
//!
//! Run with `--nocapture` to print each root, for comparing against a deployed faucet's map.

use miden_protocol::asset::FungibleAsset;
use miden_protocol::note::Note;
use miden_protocol::{Felt, Word};
use miden_standards::note::config::{PauseConfigNote, RbacConfig};
use miden_usdcx::account::xreserve::XReserveStablecoinBuilder;
use usdcx_admin_notes::testing::{faucet_and_sender, other_account};

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

fn every_admin_note() -> Vec<(&'static str, Note)> {
    let (faucet, sender) = faucet_and_sender();
    let other = other_account();
    let role = usdcx_admin_notes::role_symbol(usdcx_admin_notes::DOM_PAUSER_ROLE).unwrap();
    let fee_asset = FungibleAsset::new(faucet, 100).unwrap();
    vec![
        (
            "set_max_supply",
            usdcx_admin_notes::set_max_supply(faucet, sender, 1_000_000, serial(1)).unwrap(),
        ),
        (
            "set_note_fee",
            usdcx_admin_notes::set_note_fee(
                faucet,
                sender,
                PauseConfigNote::script_root(),
                fee_asset,
                serial(2),
            )
            .unwrap(),
        ),
        (
            "rbac_grant",
            usdcx_admin_notes::rbac(
                faucet,
                sender,
                RbacConfig::GrantRole { role: role.clone(), account: other },
                serial(3),
            )
            .unwrap(),
        ),
        (
            "rbac_revoke",
            usdcx_admin_notes::rbac(
                faucet,
                sender,
                RbacConfig::RevokeRole { role, account: other },
                serial(4),
            )
            .unwrap(),
        ),
        ("pause", usdcx_admin_notes::pause(faucet, sender, false, serial(5)).unwrap()),
        ("unpause", usdcx_admin_notes::pause(faucet, sender, true, serial(6)).unwrap()),
        ("block", usdcx_admin_notes::blocklist(faucet, sender, other, false, serial(7)).unwrap()),
        ("unblock", usdcx_admin_notes::blocklist(faucet, sender, other, true, serial(8)).unwrap()),
        ("set_min_burn", usdcx_admin_notes::set_min_burn(faucet, sender, 1, serial(9)).unwrap()),
        (
            "set_attester",
            usdcx_admin_notes::set_attester(faucet, sender, serial(10), true, serial(11)).unwrap(),
        ),
    ]
}

#[test]
fn every_admin_note_script_is_on_the_faucet_allowlist() {
    let allowed = XReserveStablecoinBuilder::allowed_note_scripts();
    for (name, note) in every_admin_note() {
        let root = note.script().root();
        let hex: String = root.as_word().as_bytes().iter().map(|b| format!("{b:02x}")).collect();
        println!("NOTE {name} {hex}");
        assert!(allowed.contains(&root), "{name}: script root {hex} is not on the faucet allowlist");
    }
}
