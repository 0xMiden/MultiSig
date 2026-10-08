# Node protobuf codec

`miden_node.json` is the protobufjs JSON descriptor of the node's `rpc.proto` (plus the
`miden-objects` type protos it imports). `miden_node.js` / `miden_node.d.ts` are generated from it
by `scripts/gen-history-proto.mjs` (`npm run proto:history`): static protobufjs code for just the
messages `../nodeRpc.ts` needs (`Status`, `SyncTransactions`), which lets the browser call
`SyncTransactions`, a method the web SDK does not wrap.

The codec has to be static code. protobufjs's reflection runtime (`Root.fromJSON`) compiles its
encoders and decoders with `new Function(...)`, which the production Content-Security-Policy
forbids (`script-src` has no `'unsafe-eval'`; `src/lib/securityHeaders.ts` adds it in dev only), so
the History page loaded locally but failed on the deployed console. `tests/admin/historyCsp.test.ts`
guards that.

Regenerate after a node bump (match the `miden-node-proto-build` and `miden-objects` versions the
deployed node runs on):

```
npx pbjs -t json \
  -p ~/.cargo/registry/src/*/miden-objects-<ver>/proto \
  -p ~/.cargo/registry/src/*/miden-node-proto-build-<ver>/proto \
  -o src/lib/history/proto/miden_node.json \
  ~/.cargo/registry/src/*/miden-node-proto-build-<ver>/proto/rpc.proto
npm run proto:history
```

Also bump `ACCEPT` in `../nodeRpc.ts` if the node's major.minor (or pre-release label) changes:
the node refuses a mismatched version label.
