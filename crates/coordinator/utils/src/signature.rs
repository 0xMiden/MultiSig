use miden_crypto::{
    Felt,
    dsa::rpo_falcon512::{Polynomial, Signature},
};
use miden_objects::Hasher;

/// Turn RPO Falcon512 [`Signature`] into a `Vec<Felt>` what would have been obtained using
/// [`TransactionAuthenticator::get_signature`](https://docs.rs/miden-client/0.11.11/miden_client/auth/trait.TransactionAuthenticator.html#tymethod.get_signature).
///
/// Slightly modified implementation of [`miden_tx::auth::signatures::get_falcon_signature`](https://docs.rs/miden-tx/0.11.5/miden_tx/auth/signatures/fn.get_falcon_signature.html).
// TODO: deprecate this after miden-client v0.12 is available.
pub fn rpo_falcon512_signature_into_felt_vec(sig: Signature) -> Vec<Felt> {
    // The signature is composed of a nonce and a polynomial s2
    // The nonce is represented as 8 field elements.
    let nonce = sig.nonce();

    let s2 = sig.sig_poly();

    // We also need in the VM the expanded key corresponding to the public key that was provided
    // via the operand stack
    let h = &sig.pk_poly().0;

    // Lastly, for the probabilistic product routine that is part of the verification procedure,
    // we need to compute the product of the expanded key and the signature polynomial in
    // the ring of polynomials with coefficients in the Miden field.
    let pi = Polynomial::mul_modulo_p(h, s2);

    // We now push the expanded key, the signature polynomial, and the product of the
    // expanded key and the signature polynomial to the advice stack. We also push
    // the challenge point at which the previous polynomials will be evaluated.
    // Finally, we push the nonce needed for the hash-to-point algorithm.

    let mut polynomials: Vec<Felt> =
        h.coefficients.iter().map(|a| Felt::from(a.value() as u32)).collect();
    polynomials.extend(s2.coefficients.iter().map(|a| Felt::from(a.value() as u32)));
    polynomials.extend(pi.iter().map(|a| Felt::new(*a)));

    let digest_polynomials = Hasher::hash_elements(&polynomials);
    let challenge = (digest_polynomials[0], digest_polynomials[1]);

    let mut result: Vec<Felt> = vec![challenge.0, challenge.1];
    result.extend_from_slice(&polynomials);
    result.extend_from_slice(&nonce.to_elements());

    result.reverse();

    result
}

#[cfg(test)]
mod tests {
    use miden_crypto::{
        dsa::rpo_falcon512::{SecretKey, Signature},
        hash::rpo::Rpo256,
    };
    use miden_tx::auth::signatures;
    use rand::SeedableRng;
    use rand_chacha::ChaCha20Rng;

    const RNG_SEED: u64 = 8086;

    #[test]
    fn turning_rpo_falcon512_signature_into_felt_vec_works() {
        // Arrange
        let sk = SecretKey::new();
        let msg = Rpo256::hash(b"miden will get multisig");

        let sig: Signature = sk.sign_with_rng(msg, &mut ChaCha20Rng::seed_from_u64(RNG_SEED));

        // Act
        let felt_vec = super::rpo_falcon512_signature_into_felt_vec(sig);

        // Assert
        let expected_felt_vec =
            signatures::get_falcon_signature(&sk, msg, &mut ChaCha20Rng::seed_from_u64(RNG_SEED))
                .expect("valid secret key must be able to sign the message");

        assert_eq!(felt_vec, expected_felt_vec);
    }
}
