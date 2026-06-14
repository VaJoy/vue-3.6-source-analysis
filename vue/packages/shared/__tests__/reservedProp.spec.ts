import { isReservedProp } from '../src'

test('isReservedProp', () => {
  expect(isReservedProp('key')).toBe(true)
  expect(isReservedProp('ref')).toBe(true)
  expect(isReservedProp('ref_for')).toBe(true)
  expect(isReservedProp('ref_key')).toBe(true)
  expect(isReservedProp('onVnodeBeforeMount')).toBe(true)
  expect(isReservedProp('onVnodeMounted')).toBe(true)
  expect(isReservedProp('onVnodeBeforeUpdate')).toBe(true)
  expect(isReservedProp('onVnodeUpdated')).toBe(true)
  expect(isReservedProp('onVnodeBeforeUnmount')).toBe(true)
  expect(isReservedProp('onVnodeUnmounted')).toBe(true)
})
