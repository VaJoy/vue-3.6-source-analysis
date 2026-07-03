import { makeMap } from "./makeMap"

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}

export const EMPTY_ARR: readonly never[] = __DEV__ ? Object.freeze([]) : []

/** 空函数 */
export const NOOP = (): void => {}

/** 生成一个方法，用于判断一个属性名是否是保留属性 */
export const isReservedProp: (key: string) => boolean = /*@__PURE__*/ makeMap(
  ",key,ref,ref_for,ref_key," +
    "onVnodeBeforeMount,onVnodeMounted," +
    "onVnodeBeforeUpdate,onVnodeUpdated," +
    "onVnodeBeforeUnmount,onVnodeUnmounted",
)
