/**
 * 把一个用逗号分隔的字符串（例如 "a,b,c" ）预处理成一个“成员判断函数”，
 * 用于在运行时高频地判断某个 key 是否属于某个固定集合。
 *
 * 示例：
 * const isHTMLTag = makeMap('div,span,p')
 * isHTMLTag('div') // true
 * isHTMLTag('a')   // false
 */

/*@__NO_SIDE_EFFECTS__*/
export function makeMap(str: string): (key: string) => boolean {
  const map = Object.create(null);
  for (const key of str.split(",")) map[key] = 1;
  return (val) => val in map;
}
