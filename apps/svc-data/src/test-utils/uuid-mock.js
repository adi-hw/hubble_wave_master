/**
 * CommonJS shim for the ESM-only `uuid` package so unit tests don't need
 * real UUID generation. Jest's transform pipeline cannot natively load
 * `uuid`'s ESM bundle.
 */
let counter = 0;

function generate() {
  counter += 1;
  return `00000000-0000-0000-0000-${counter.toString().padStart(12, '0')}`;
}

module.exports = {
  v1: generate,
  v3: generate,
  v4: generate,
  v5: generate,
  NIL: '00000000-0000-0000-0000-000000000000',
  validate: () => true,
  version: () => 4,
};
