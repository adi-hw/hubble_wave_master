// CommonJS shim for the ESM-only `uuid` package, used only in jest unit tests.
// Real UUID generation is not required for the rollback contract specs.
let counter = 0;
function fakeId() {
  counter += 1;
  const hex = counter.toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

module.exports = {
  v4: fakeId,
  v1: fakeId,
  v3: fakeId,
  v5: fakeId,
  v6: fakeId,
  v7: fakeId,
  validate: () => true,
  stringify: () => fakeId(),
  parse: () => Buffer.alloc(16),
  NIL: '00000000-0000-0000-0000-000000000000',
  MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  version: () => 4,
};
