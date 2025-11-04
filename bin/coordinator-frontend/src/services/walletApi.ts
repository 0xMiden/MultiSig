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
    console.log("pubkey commits", pubKeyCommits);

    // Convert hex elements to base64
    const base64PubKeyCommits: string[] = [];
    for (let i = 0; i < pubKeyCommits.length; i++) {
      const hexString = pubKeyCommits[i];
      // Remove '0x' prefix if present
      const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      // Convert hex to buffer then to base64
      const buffer = Buffer.from(cleanHex, 'hex');
      const base64String = buffer.toString('base64');
      base64PubKeyCommits.push(base64String);
    }
    console.log("base64 pubkey commits", base64PubKeyCommits);

    if (threshold > approvers.length) {
      throw new Error(`Threshold (${threshold}) cannot be greater than total approvers (${approvers.length})`);
    }

    const apiPayload = {
      threshold,
      approvers,
      pub_key_commits: base64PubKeyCommits,

    };


    console.log("api payload", apiPayload);
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