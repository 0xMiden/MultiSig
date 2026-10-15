// `next.config`'s asset/resource rule turns a `.wasm` import into a URL string (not WebAssembly
// bindings) so it can be passed to `__wbg_init({ module_or_path: wasmUrl })` in the browser.
declare module '*.wasm' {
  const url: string;
  export default url;
}

// Vite/Vitest's dev server has native (non-webpack) handling for raw `.wasm` imports, which
// rejects them outright ("ESM integration proposal for Wasm is not supported"). The `?url`
// suffix opts into Vite's explicit URL-import mode instead, which — like the webpack rule
// above — resolves to a URL string. Rule matching for both bundlers is on the file path, not
// the query string, so this suffix doesn't change the webpack asset/resource behavior above.
declare module '*.wasm?url' {
  const url: string;
  export default url;
}
