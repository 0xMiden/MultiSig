// Component-specific types

// Dashboard Components
export interface SidebarPage {
  pageName: string;
  pageIcon: string;
  path: string;
}

export interface TaskBarProps {
  className?: string;
}

export interface PendingActionsProps {
  threshold?: number;
  fixedHeight?: boolean; // If true, shows fixed height for 5 items (home page), if false/undefined, shows scrollable (transactions page)
}

export interface RecentTransactionsProps {
  threshold: number;
  fixedHeight?: boolean; // If true, shows fixed height for 5 items (home page), if false/undefined, shows scrollable (transactions page)
}

export interface MultisigSetupProps {
  className?: string;
}

// Transaction Components
export interface DecodedTransaction {
  id: string;
  status: string;
  signature_count: number;
  type: string;
  transactionType: "sent" | "received" | null;
  recipient: string;
  amount: number;
  currency: string;
  priority: string;
  memo: string;
  timestamp: number | null;
  created_at: string;
  tx_summary?: string;
  tx_request?: string;
  input_note_ids?: Array<{ note_id: string; note_id_file_bytes: string }>;
}

// Asset Components
export interface TokenHoldingsProps {
  fungibleAssets: FungibleAsset[];
  isLoading: boolean;
}

// Wallet Components
export interface WalletConnectionProps {
  className?: string;
}

export interface WalletInfoProps {
  className?: string;
}

export interface WalletStatusProps {
  className?: string;
}

export interface WalletTransactionProps {
  className?: string;
}

export interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretKey: string;
  setSecretKey: (key: string) => void;
  approverAddress: string;
  setApproverAddress: (address: string) => void;
  onConnect: () => void;
}

export interface TransferBoxProps {
  transaction: Transaction;
  index: number;
  threshold?: number;
  onApprove?: (txId: string) => void;
  isSelected?: boolean;
  onSelect?: (txId: string) => void;
}

// Interaction Components
export interface InitiateFundTransferProps {
  onCancel?: () => void;
  fungibleAssets: FungibleAsset[];
  isLoading: boolean;
  onOpen?: () => Promise<void>;
}

// Notification Types
export interface Notification {
  type: "success" | "error";
  message: string;
}

// Import types
import { FungibleAsset } from '../hooks/useFungibleAssets';
import { Transaction } from './transaction';
