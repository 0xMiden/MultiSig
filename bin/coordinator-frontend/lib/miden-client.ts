import {
    WebClient,
    ConsumableNoteRecord,
    Account
} from "@demox-labs/miden-sdk";

export class MidenWebClientHandle {
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

            try {
                this.webClient = await WebClient.createClient(nodeEndpoint);
            } catch (error: any) {
                console.error("Error creating Miden client:", error);

                // Check for specific IndexedDB upgrade error or generic WebStore initialization failure
                // The SDK might wrap the underlying DB error into "Failed to initialize WebStore"
                if (error?.message?.includes("UpgradeError") ||
                    error?.message?.includes("Not yet support for changing primary key") ||
                    error?.message?.includes("Failed to initialize WebStore") ||
                    error?.toString().includes("Failed to initialize WebStore")) {
                    console.warn("Database schema mismatch or init failure detected. Attempting to clear database...");

                    const DB_NAME = "MidenClientDB";

                    try {
                        await new Promise<void>((resolve, reject) => {
                            const req = indexedDB.deleteDatabase(DB_NAME);

                            // Add a timeout to prevent hanging
                            const timeoutId = setTimeout(() => {
                                reject(new Error("Database deletion timed out. Please close other tabs and reload."));
                            }, 5000);

                            req.onsuccess = () => {
                                clearTimeout(timeoutId);
                                console.log(`Successfully deleted database: ${DB_NAME}`);
                                resolve();
                            };

                            req.onerror = () => {
                                clearTimeout(timeoutId);
                                console.error(`Failed to delete database: ${DB_NAME}`);
                                reject(req.error);
                            };

                            req.onblocked = () => {
                                console.warn(`Database deletion blocked: ${DB_NAME}. Please close other tabs using this app.`);
                                // We don't reject immediately on blocked, as it might unblock if user closes tabs,
                                // but the timeout will catch it if it takes too long.
                            };
                        });

                        // Retry initialization
                        console.log("Retrying initialization after database cleanup...");
                        this.webClient = await WebClient.createClient(nodeEndpoint);
                    } catch (cleanupError) {
                        console.error("Failed to recover from database error:", cleanupError);
                        throw cleanupError; // Re-throw to be caught by outer catch
                    }
                } else {
                    throw error;
                }
            }

            console.log("Miden Web Client initialized successfully!");

            return true;
        } catch (error) {
            console.error("Failed to initialize Miden Web Client:", error);
            return false;
        }
    }

    /**
     Sync state with the Miden chain
     */
    async syncState(): Promise<boolean> {
        try {
            console.log("\nSyncing state with Miden chain...");
            await this.webClient!.syncState();
            console.log("State synced successfully!");
            return true;
        } catch (error) {
            console.error("Failed to sync state:", error);
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