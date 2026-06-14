import { makeMap } from "./makeMap"

/** 空函数 */
export const NOOP = (): void => {}

/** 生成一个方法，用于判断一个属性名是否是保留属性 */
export const isReservedProp: (key: string) => boolean = /*@__PURE__*/ makeMap(
  ",key,ref,ref_for,ref_key," +
    "onVnodeBeforeMount,onVnodeMounted," +
    "onVnodeBeforeUpdate,onVnodeUpdated," +
    "onVnodeBeforeUnmount,onVnodeUnmounted",
)
