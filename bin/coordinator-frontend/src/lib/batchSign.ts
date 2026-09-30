export interface BatchFailure {
  id: string;
  message: string;
}

export interface BatchResult {
  signed: string[];
  failed: BatchFailure[];
}

/**
 * Signs each proposal in turn and keeps every failure's own reason, so one
 * failure is neither hidden by a later success nor merged into a count.
 */
export async function signEach(ids: readonly string[], sign: (id: string) => Promise<unknown>): Promise<BatchResult> {
  const result: BatchResult = { signed: [], failed: [] };
  for (const id of ids) {
    try {
      await sign(id);
      result.signed.push(id);
    } catch (error) {
      result.failed.push({ id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
