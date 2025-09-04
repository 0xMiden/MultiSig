.DEFAULT_GOAL := help

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# -- variables --------------------------------------------------------------------------------------

WARNINGS=RUSTDOCFLAGS="-D warnings"
DEBUG_OVERFLOW_INFO=RUSTFLAGS="-C debug-assertions -C overflow-checks -C debuginfo=2"

# -- linting --------------------------------------------------------------------------------------

.PHONY: clippy
clippy: ## Run Clippy with configs
	$(WARNINGS) cargo clippy --workspace --all-targets --all-features


.PHONY: fix
fix: ## Run Fix with configs
	cargo +nightly fix --allow-staged --allow-dirty --all-targets --all-features


.PHONY: format
format: ## Run Format using nightly toolchain
	cargo +nightly fmt --all


.PHONY: format-check
format-check: ## Run Format using nightly toolchain but only in check mode
	cargo +nightly fmt --all --check

.PHONY: machete
machete: ## Runs machete to find unused dependencies
	cargo machete

.PHONY: toml
toml: ## Runs Format for all TOML files
	taplo fmt

.PHONY: toml-check
toml-check: ## Runs Format for all TOML files but only in check mode
	taplo fmt --check --verbose

.PHONY: typos-check
typos-check: ## Runs spellchecker
	typos

.PHONY: workspace-check
workspace-check: ## Runs a check that all packages have `lints.workspace = true`
	cargo workspace-lints

.PHONY: lint
lint: format fix clippy toml typos-check machete ## Run all linting tasks at once (Clippy, fixing, formatting, machete)

# --- docs ----------------------------------------------------------------------------------------

.PHONY: doc
doc: ## Nothing to do now

# --- testing -------------------------------------------------------------------------------------

.PHONY: test-build
test-build: ## Build the test binary
	cargo nextest run --all-features --no-run

.PHONY: test
test: ## Run tests with default features
	$(DEBUG_OVERFLOW_INFO) cargo nextest run --profile default --release --all-features

# --- checking ------------------------------------------------------------------------------------

.PHONY: check
check: ## Check all targets and features for errors without code generation
	cargo check --all-targets --all-features

# --- building ------------------------------------------------------------------------------------

.PHONY: build
build: ## Build with default features enabled
	cargo build --release

# --- installing ----------------------------------------------------------------------------------

.PHONY: check-tools
check-tools: ## Checks if development tools are installed
	@echo "Checking development tools..."
	@command -v typos >/dev/null 2>&1 && echo "[OK] typos is installed" || echo "[MISSING] typos is not installed (run: make install-tools)"
	@command -v cargo nextest >/dev/null 2>&1 && echo "[OK] nextest is installed" || echo "[MISSING] nextest is not installed (run: make install-tools)"
	@command -v taplo >/dev/null 2>&1 && echo "[OK] taplo is installed" || echo "[MISSING] taplo is not installed (run: make install-tools)"
	@command -v cargo machete >/dev/null 2>&1 && echo "[OK] machete is installed" || echo "[MISSING] machete is not installed (run: make install-tools)"

.PHONY: install-tools
install-tools: ## Installs development tools required by the Makefile (typos, nextest, taplo, machete)
	@echo "Installing development tools..."
	cargo install typos-cli --locked
	cargo install cargo-nextest --locked
	cargo install taplo-cli --locked
	cargo install cargo-machete --locked
	@echo "Development tools installation complete!"
