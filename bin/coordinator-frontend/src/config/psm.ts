export const GUARDIAN_ENDPOINT = process.env.NEXT_PUBLIC_GUARDIAN_ENDPOINT || '';
export const MIDEN_RPC_URL = process.env.NEXT_PUBLIC_MIDEN_RPC_URL || 'devnet';
export const MIDEN_NOTE_TRANSPORT_URL = process.env.NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL || 'devnet';
export const MIDEN_REGISTRATION_CODE = process.env.NEXT_PUBLIC_MIDEN_REGISTRATION_CODE || 'guardian';
export const MIDEN_DB_NAME = 'MidenClientDB';

export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
export const PARA_ENVIRONMENT = (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT || 'development') as
  | 'development'
  | 'production';
