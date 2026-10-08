# Node protobuf descriptor

`miden_node.json` is the protobufjs JSON descriptor of the node's `rpc.proto` (plus the
`miden-objects` type protos it imports), loaded at runtime by `../nodeRpc.ts` with
`protobuf.Root.fromJSON`. It is what lets the browser call `SyncTransactions`, which the web SDK
does not wrap.

Regenerate after a node bump (match the `miden-node-proto-build` and `miden-objects` versions the
deployed node runs on):

```
npx -p protobufjs-cli pbjs -t json \
  -p ~/.cargo/registry/src/*/miden-objects-<ver>/proto \
  -p ~/.cargo/registry/src/*/miden-node-proto-build-<ver>/proto \
  -o src/lib/history/proto/miden_node.json \
  ~/.cargo/registry/src/*/miden-node-proto-build-<ver>/proto/rpc.proto
```

Also bump `ACCEPT` in `../nodeRpc.ts` if the node's major.minor (or pre-release label) changes:
the node refuses a mismatched version label.
