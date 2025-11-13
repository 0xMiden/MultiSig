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
            this.webClient = await WebClient.createClient(nodeEndpoint);
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