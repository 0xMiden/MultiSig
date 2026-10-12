//! Tests for the current-on-chain-config readers (`current_token_supply`, `current_max_supply`,
//! `current_min_burn`), which the admin console reads to show live values and to validate a new max
//! supply before a proposal is created.
//!
//! The token-config word is `[token_supply, max_supply, decimals, token_symbol]`, so `token_supply`
//! and `max_supply` are read from the SAME slot at DIFFERENT indices. This fixture issues a token
//! supply (1_000_000) well below the faucet's max supply, so a reader that read the wrong index
//! would return the other value — these assertions pin each reader to its own felt.

use usdcx_admin_notes::testing::{faucet_with_admin, faucet_with_attesters};
use usdcx_admin_notes::{current_max_supply, current_token_supply, enabled_attesters};

/// The fixture (`faucet_with_admin`) builds the production faucet with a token supply of 1_000_000.
const FIXTURE_TOKEN_SUPPLY: u64 = 1_000_000;

#[test]
fn current_token_supply_reads_the_issued_supply() {
    let (faucet, _holder, _other) = faucet_with_admin();
    assert_eq!(
        current_token_supply(&faucet),
        FIXTURE_TOKEN_SUPPLY,
        "current_token_supply must read token_config word[0] (the issued supply)",
    );
}

#[test]
fn token_supply_and_max_supply_read_distinct_token_config_felts() {
    let (faucet, _holder, _other) = faucet_with_admin();
    let supply = current_token_supply(&faucet);
    let max = current_max_supply(&faucet);
    // The faucet can still issue up to its cap, so max supply is strictly above the issued supply.
    // If either reader read the wrong felt of the token-config word, these two would collide.
    assert_eq!(supply, FIXTURE_TOKEN_SUPPLY);
    assert!(
        max > supply,
        "max supply ({max}) must exceed the issued token supply ({supply}); \
         a collision means a reader is reading the wrong token_config index",
    );
}

#[test]
fn enabled_attesters_is_empty_on_an_unseeded_faucet() {
    let (faucet, _holder, _other) = faucet_with_admin();
    assert!(enabled_attesters(&faucet).is_empty());
}

#[test]
fn enabled_attesters_lists_enabled_commitments_and_skips_disabled_ones() {
    let (faucet, enabled, disabled) = faucet_with_attesters();
    let listed = enabled_attesters(&faucet);
    assert_eq!(listed, vec![enabled], "only the attester under the enabled marker is listed");
    assert!(!listed.contains(&disabled), "a disabled attester (zero marker) must not be listed");
}
