import {
    AccountId,
    AccountStorageMode,
    NoteType,
    WebClient,
    ConsumableNoteRecord,
    Account,
    FungibleAsset
} from "@demox-labs/miden-sdk";

export interface BalanceInfo {
    noteCount: number;
    notes: ConsumableNoteRecord[];
    accountId: string | null;
    error?: string;
}

export interface TransactionRequest {
    senderAccountId: string;
    recipientAccountId: string;
    faucetId: string;
    noteType: 'Private' | 'Public';
    amount: bigint;
}

export class MidenDemo {
    private webClient: WebClient | null = null;
    private account: Account | null = null;

    constructor() {
        this.webClient = null;
        this.account = null;
    }

    /**
     * Initialize the Miden Web Client
     */
    async initialize(): Promise<boolean> {
        try {
            console.log("Initializing Miden Web Client...");
            const nodeEndpoint = process.env.NEXT_PUBLIC_MIDEN_NODE_ENDPOINT || "https://rpc.testnet.miden.io:443";
            console.log(`Using Miden node endpoint: ${nodeEndpoint}`);
            this.webClient = await WebClient.createClient(nodeEndpoint);
            console.log("Miden Web Client initialized successfully!");

            return true;
        } catch (error) {
            console.error("Failed to initialize Miden Web Client:", error);
            return false;
        }
    }

    /**
     Create a new wallet
     */
    async createWallet(): Promise<Account | null> {
        try {
            console.log("\nCreating a new wallet...");

            // Set up wallet parameters
            const accountStorageMode = AccountStorageMode.private();
            const mutable = true;

            // Create new wallet
            this.account = await this.webClient!.newWallet(accountStorageMode, mutable);
            console.log("Wallet created successfully!");
            console.log(this.account.code().toString());
            console.log(`   Account ID: ${this.account.id().toString()}`);
            console.log(`   Is Public: ${this.account.isPublic()}`);
            console.log(`   Is Faucet: ${this.account.isFaucet()}`);

            return this.account;
        } catch (error) {
            console.error("Failed to create wallet:", error);
            return null;
        }
    }

    /**
     Sync state with the Miden chain
     */
    async syncState(): Promise<boolean> {
        try {
            console.log("\nSyncing state with Miden chain...");
            await this.webClient!.syncState();
            console.log("State synced successfully Vaibhav!");
            return true;
        } catch (error) {
            console.error("Failed to sync state:", error);
            return false;
        }
    }

    /**
     * Set account from wallet ID stored in localStorage
     */
    async setAccountFromWalletId(walletIdHex: string): Promise<boolean> {
        try {
            if (!this.webClient) {
                throw new Error("WebClient not initialized. Call initialize() first.");
            }

            console.log(`\nSetting account from wallet ID: ${walletIdHex}`);

            // Convert hex to AccountId object
            const accountId = AccountId.fromHex(walletIdHex);
            console.log(`Converted to AccountId: ${accountId.toString()}`);

            // Get Account object using WebClient
            const account = await this.webClient.getAccount(accountId);

            if (account) {
                this.account = account;
                console.log(`Account set successfully!`);
                console.log(`   Account ID: ${this.account.id().toString()}`);
                console.log(`   Is Public: ${this.account.isPublic()}`);
                console.log(`   Is Faucet: ${this.account.isFaucet()}`);
                return true;
            } else {
                throw new Error("Account not found on the blockchain");
            }
        } catch (error) {
            console.error("Failed to set account from wallet ID:", error);
            return false;
        }
    }

    /**
     * Get consumable notes for the account
     */
    async getConsumableNotes(): Promise<ConsumableNoteRecord[]> {
        try {
            console.log("\nFetching consumable notes...");
            const consumableNotes = await this.webClient!.getConsumableNotes(this.account?.id());
            console.log(consumableNotes);
            console.log(`Found ${consumableNotes.length} consumable notes`);
            return consumableNotes;
        } catch (error) {
            console.error("Failed to get consumable notes:", error);
            return [];
        }
    }

    /**
     * Create and execute a consume transaction
     */
    async createConsumeTransaction(noteIds: (string | bigint)[]): Promise<unknown> {
        try {
            console.log("\nCreating consume transaction...");
            console.log("Original note IDs:", noteIds);

            // Safety checks
            if (!this.webClient) {
                throw new Error("WebClient not initialized");
            }
            if (!this.account) {
                throw new Error("Account not created");
            }
            if (!noteIds || noteIds.length === 0) {
                throw new Error("No note IDs provided");
            }

            console.log("Safety checks passed");

            // Ensure we have the latest account state
            console.log("Syncing state before transaction...");
            await this.syncState();

            console.log("Account object:", this.account);
            console.log("WebClient object:", this.webClient);

            // Convert all noteIds to strings
            const stringNoteIds = noteIds.map(id => id.toString());
            console.log("Converted to strings:", stringNoteIds);

            // Create a consume transaction request object
            console.log("Creating consume transaction request...");
            const consumeTransactionRequest = this.webClient.newConsumeTransactionRequest(stringNoteIds);
            // const trnxRes = this.webClient.newTransaction(this.account.id(), );
            console.log("Consume transaction request created:", consumeTransactionRequest);

            console.log("Executing and proving transaction...");

            // Try to get fresh account state, fallback to original account
            let accountToUse = this.account;
            try {
                console.log("Attempting to get fresh account state...");
                const freshAccount = await this.webClient.getAccount(this.account.id());
                console.log("Fresh account retrieved:", freshAccount.id().toString());
                accountToUse = freshAccount;
            } catch (accountError) {
                console.log("Could not get fresh account, using original:", accountError);
                accountToUse = this.account;
            }

            // Execute and prove the transaction client side
            console.log("Using account:", accountToUse.id().toString());
            const consumeTransactionResult = await this.webClient.newTransaction(
                this.account.id(),
                consumeTransactionRequest
            );

            console.log("Transaction execution completed:", consumeTransactionResult);

            console.log("Submitting transaction to the node...");
            // Submit the transaction to the node
            await this.webClient.submitTransaction(consumeTransactionResult);

            console.log("Transaction submitted successfully!");
            return consumeTransactionResult;
        } catch (error) {
            console.error("Failed to create/execute consume transaction:", error);
            return null;
        }
    }

    /**
     * Create a simple send transaction (without auto-consuming notes)
     */
    async createSimpleSendTransaction(transactionRequest: TransactionRequest): Promise<unknown> {
        try {
            console.log("\nCreating simple send transaction...");
            console.log("Transaction details:", transactionRequest);

            // Safety checks
            if (!this.webClient) {
                throw new Error("WebClient not initialized");
            }
            if (!this.account) {
                throw new Error("Account not created");
            }

            console.log("Safety checks passed");

            // Create AccountId objects
            const senderAccountId = AccountId.fromHex(transactionRequest.senderAccountId);
            const recipientAccountId = AccountId.fromHex(transactionRequest.recipientAccountId);
            const faucetAccountId = AccountId.fromHex(transactionRequest.faucetId);

            // Create the transaction request
            console.log("Creating send transaction request...");
            const sendTransactionRequest = this.webClient.newSendTransactionRequest(
                senderAccountId,
                recipientAccountId,
                faucetAccountId,
                transactionRequest.noteType === 'Private' ? NoteType.Private : NoteType.Public,
                transactionRequest.amount
            );

            console.log("Send transaction request created:", sendTransactionRequest);

            // Execute the transaction
            console.log("Executing transaction...");
            const transactionResult = await this.webClient.newTransaction(
                this.account.id(),
                sendTransactionRequest
            );

            console.log("Transaction executed successfully:", transactionResult);

            // Submit the transaction
            console.log("Submitting transaction to the node...");
            await this.webClient.submitTransaction(transactionResult);

            console.log("Transaction submitted successfully!");
            return transactionResult;

        } catch (error) {
            console.error("Failed to create simple send transaction:", error);
            throw error;
        }
    }

    /**
     * Create a send transaction
     */
    async createSendTransaction(transactionRequest: TransactionRequest): Promise<unknown> {
        try {
            console.log("\nCreating send transaction...");
            console.log("Transaction details:", transactionRequest);

            // Safety checks
            if (!this.webClient) {
                throw new Error("WebClient not initialized");
            }
            if (!this.account) {
                throw new Error("Account not created");
            }

            console.log("Safety checks passed");

            // Check if we need to consume notes first
            console.log("Checking vault balance...");
            const vaultAssets = this.account.vault().fungibleAssets();
            let vaultBalance = BigInt(0);
            for (const asset of vaultAssets) {
                vaultBalance += asset.amount();
            }

            console.log("Current vault balance:", vaultBalance.toString());
            console.log("Amount to send:", transactionRequest.amount.toString());

            // If vault balance is insufficient, consume notes first
            if (vaultBalance < transactionRequest.amount) {
                console.log("Insufficient vault balance. Consuming notes first...");

                const notes = await this.getConsumableNotes();
                if (notes.length === 0) {
                    throw new Error("No consumable notes available and insufficient vault balance");
                }

                console.log("Consuming notes to increase vault balance...");
                const consumeResult = await this.createConsumeTransaction(notes.map(note => note.inputNoteRecord().id().toString()));

                if (!consumeResult) {
                    throw new Error("Failed to consume notes");
                }

                console.log("Notes consumed successfully");

                // Update vault balance after consuming
                const newVaultAssets = this.account.vault().fungibleAssets();
                vaultBalance = BigInt(0);
                for (const asset of newVaultAssets) {
                    vaultBalance += asset.amount();
                }
                console.log("New vault balance:", vaultBalance.toString());
            }

            // Create AccountId objects
            const senderAccountId = AccountId.fromHex(transactionRequest.senderAccountId);
            const recipientAccountId = AccountId.fromHex(transactionRequest.recipientAccountId);
            const faucetAccountId = AccountId.fromHex(transactionRequest.faucetId);

            // Create the transaction request
            console.log("Creating send transaction request...");
            const sendTransactionRequest = this.webClient.newSendTransactionRequest(
                senderAccountId,
                recipientAccountId,
                faucetAccountId,
                transactionRequest.noteType === 'Private' ? NoteType.Private : NoteType.Public,
                transactionRequest.amount
            );

            console.log("Send transaction request created:", sendTransactionRequest);

            // Execute the transaction
            console.log("Executing transaction...");
            const transactionResult = await this.webClient.newTransaction(
                this.account.id(),
                sendTransactionRequest
            );

            console.log("Transaction executed successfully:", transactionResult);

            // Submit the transaction
            console.log("Submitting transaction to the node...");
            await this.webClient.submitTransaction(transactionResult);

            console.log("Transaction submitted successfully!");
            return transactionResult;

        } catch (error) {
            console.error("Failed to create send transaction:", error);
            throw error;
        }
    }

    /**
     * Test worker communication
     */
    async testWorkerCommunication(): Promise<boolean> {
        try {
            console.log("\nTesting worker communication...");

            // Try a simple sync operation first
            await this.syncState();
            console.log("Worker communication test passed - sync worked");

            return true;
        } catch (error) {
            console.error("Worker communication test failed:", error);
            return false;
        }
    }

    /**
     * Check account balance
     */
    async checkBalance(assetId: string | null = null): Promise<number> {
        // Get consumable notes first
        const notes = await this.getConsumableNotes();

        this.account!.vault().fungibleAssets().forEach((asset: FungibleAsset) => {
            console.log(asset.amount().toString());
            return asset.amount().toString();
        });

        console.log("222222222222222222222222222222222225678899090899")

        // Check if notes exist before trying to access them
        if (notes.length > 0) {
            console.log("22222222222222222222222222222222222222222222222", notes[0].inputNoteRecord().details().assets().fungibleAssets()[0].faucetId())
            const transactionRequest = this.webClient!.newSendTransactionRequest(
                AccountId.fromHex("0xed8227af78044f907f988cbeefa59a"),  // Account sending tokens
                AccountId.fromHex("0x51e34a12fdf71c9044a617cc893afd"),  // Account receiving tokens
                notes[0].inputNoteRecord().details().assets().fungibleAssets()[0].faucetId(),        // Faucet account ID
                NoteType.Private, // Note type
                BigInt(50),             // Amount to send
            );

            const serialized_req = transactionRequest.serialize()
            console.log("SERIALIZED TRXV REQ. - ", serialized_req)
        } else {
            console.log("No consumable notes available - cannot create transaction")
        }

        return 1;
    }

    /**
     * Get total balance info (for web interface)
     */
    async getBalanceInfo(): Promise<BalanceInfo> {
        try {
            // Sync first to get latest state
            await this.syncState();

            // Get consumable notes
            const notes = await this.getConsumableNotes();

            return {
                noteCount: notes.length,
                notes: notes,
                accountId: this.account ? this.account.id().toString() : null
            };
        } catch (error) {
            console.error("Failed to get balance info:", error);
            return {
                noteCount: 0,
                notes: [],
                accountId: null,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Run the complete demo workflow
     */
    async runDemo(): Promise<void> {
        console.log("Starting Miden SDK Demo\n");
        console.log("═".repeat(50));

        // Initialize client
        const initialized = await this.initialize();
        if (!initialized) {
            console.log("Demo failed - could not initialize client");
            return;
        }

        // Create wallet
        const wallet = await this.createWallet();
        if (!wallet) {
            console.log("Demo failed - could not create wallet");
            return;
        }

        // Sync state
        await this.syncState();

        // Get consumable notes
        const notes = await this.getConsumableNotes();

        if (notes.length === 0) {
            console.log("\nNo consumable notes found.");
            console.log("\nTo test the full workflow:");
            console.log("   1. Visit https://faucet.testnet.miden.io/");
            console.log(`   2. Send test tokens to: ${this.account.id().toString()}`);
            console.log("   3. Run this demo again to consume the tokens");
        } else {
            // Create consume transaction for the first note
            const noteIdToConsume = notes[0].inputNoteRecord().id();

            await this.createConsumeTransaction([noteIdToConsume.toString()]);

            // Sync state again after transaction
            await this.syncState();

            // Check balance (you'll need to provide the asset ID)
            await this.checkBalance();
        }

        console.log("\n" + "═".repeat(50));
        console.log("Demo completed!");
    }

    // Getters for React components
    getAccount() {
        return this.account;
    }

    getWebClient() {
        return this.webClient;
    }

    isInitialized(): boolean {
        return this.webClient !== null;
    }

    hasAccount(): boolean {
        return this.account !== null;
    }
} 