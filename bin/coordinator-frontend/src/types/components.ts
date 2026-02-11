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
  fixedHeight?: boolean;
}

export interface RecentTransactionsProps {
  threshold: number;
  fixedHeight?: boolean;
}

// Asset Components
export interface FungibleAsset {
  faucetId: string;
  balance: string;
}

export interface TokenHoldingsProps {
  fungibleAssets: FungibleAsset[];
  isLoading: boolean;
}

// Notification Types
export interface Notification {
  type: "success" | "error";
  message: string;
}
