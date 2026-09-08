function fail() {
  throw new Error("sharp stub: image processing is not available in this build (text embeddings only).");
}
module.exports = new Proxy(fail, {
  get: () => fail,
  apply: () => fail(),
});
module.exports.default = module.exports;
