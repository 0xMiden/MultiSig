/**
 * Para runs four environments, and an API key only works in its own one
 * (a `beta_…` key needs BETA). Only `development` is Para's local dev stack
 * (localhost:8080 / :3000); the others are hosted under *.getpara.com.
 */
export const PARA_ENVIRONMENTS = ['development', 'sandbox', 'beta', 'production'] as const;
export type ParaEnvironment = (typeof PARA_ENVIRONMENTS)[number];

export function parseParaEnvironment(value: string | undefined): ParaEnvironment {
  const name = (value ?? '').trim().toLowerCase() || 'development';
  if ((PARA_ENVIRONMENTS as readonly string[]).includes(name)) return name as ParaEnvironment;
  throw new Error(`NEXT_PUBLIC_PARA_ENVIRONMENT must be one of ${PARA_ENVIRONMENTS.join(', ')}; got "${value}".`);
}

/** Whether Para is served from *.getpara.com (anything but its local dev stack). */
export function paraIsHosted(environment: ParaEnvironment): boolean {
  return environment !== 'development';
}
