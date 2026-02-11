export const PSM_ENDPOINT = process.env.NEXT_PUBLIC_PSM_ENDPOINT || 'https://psm-stg.openzeppelin.com';
export const MIDEN_RPC_URL = process.env.NEXT_PUBLIC_MIDEN_RPC_URL || 'https://rpc.devnet.miden.io';
export const MIDEN_DB_NAME = 'MidenClientDB';

export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
export const PARA_ENVIRONMENT = (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT || 'development') as
  | 'development'
  | 'production';
