import { readFileSync } from 'node:fs';
import * as miden from '@miden-sdk/miden-sdk';
// The pinned lazy bundle exports initSync at runtime, but omits it from its public declarations.
const { initSync } = miden as unknown as { initSync(input: {module: BufferSource}): unknown };

initSync({ module: readFileSync(new URL('../../node_modules/@miden-sdk/miden-sdk/dist/st/assets/miden_client_web.wasm', import.meta.url)) });
