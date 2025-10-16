//! build.rs file for miden-multisign-coordinator-engine

fn main() {
    println!("cargo:rerun-if-changed=../store/migrations");
}
