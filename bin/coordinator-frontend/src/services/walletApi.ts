// API service for wallet operations
import {
  CreateWalletResponse,
  GetAccountInfoResponse
} from '../types';
import { COORDINATOR_API_BASE_URL } from '../config/api';

export const createMultiSigWallet = async (walletData: {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}): Promise<CreateWalletResponse> => {
  try {
    const threshold = parseInt(walletData.signatureThreshold);
    const approvers = walletData.signerAddresses;
    const pubKeyCommits = walletData.signerPublicKeys;
    console.info('[WalletAPI] Creating multisig wallet', {
      walletName: walletData.walletName,
      approverCount: approvers.length,
      threshold,
    });

    const base64PubKeyCommits = pubKeyCommits.map((hexPk) => Uint8Array.fromHex(hexPk).toBase64());

    if (threshold > approvers.length) {
      throw new Error(`Threshold (${threshold}) cannot be greater than total approvers (${approvers.length})`);
    }

    const apiPayload = {
      threshold,
      approvers,
      pub_key_commits: base64PubKeyCommits,

    };


    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-account/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiPayload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating multisig wallet:', error);
    throw error;
  }
};

export const getAccountInfo = async (accountId: string): Promise<GetAccountInfoResponse> => {
  try {
    const requestBody = {
      multisig_account_address: accountId
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-account/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 404) {
        localStorage.removeItem('currentWalletId');
        document.cookie = 'currentWalletId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting account info:', error);
    throw error;
  }
}; 