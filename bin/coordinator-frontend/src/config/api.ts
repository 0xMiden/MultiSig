type EnvMap = Record<string, string | undefined>;

const getEnv = (key: string): string | undefined => {
  return (globalThis as { process?: { env?: EnvMap } })?.process?.env?.[key];
};

const getCoordinatorApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    return getEnv('NEXT_PUBLIC_EXTERNAL_COORDINATOR_API_URL') || getEnv('NEXT_PUBLIC_COORDINATOR_API_URL') || 'http://localhost:59059';
  }

  return getEnv('NEXT_PUBLIC_COORDINATOR_API_URL') || 'http://localhost:59059';
};

export const COORDINATOR_API_BASE_URL = getCoordinatorApiUrl();

if (getEnv('NODE_ENV') === 'development') {
  console.info(`[API] Coordinator base URL: ${COORDINATOR_API_BASE_URL}`);
}

