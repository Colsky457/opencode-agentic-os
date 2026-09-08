// Re-export the Web (WASM) backend under the node specifier.
// Agentic OS strips the 'cpu' execution provider and uses 'wasm' instead
// (see src/lib/vault.ts). Throws only if actually invoked for unsupported APIs.
module.exports = require("onnxruntime-web");
