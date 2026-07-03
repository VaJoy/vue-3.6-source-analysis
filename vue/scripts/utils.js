// @ts-check
import fs from 'node:fs'
import pico from 'picocolors'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const packagesPath = path.resolve(import.meta.dirname, '../packages')

/**
 * 所有目标包的名称
 * @type {string[]}
 */
export const allTargets = fs
  .readdirSync(packagesPath)
  .filter(f => {
    const folder = path.resolve(packagesPath, f)
    if (
      !fs.statSync(folder).isDirectory() ||
      !fs.existsSync(`${folder}/package.json`)
    ) {
      return false
    }
    const pkg = require(`${folder}/package.json`)
    if (!pkg.buildOptions) {
      return false
    }
    return true
  })

/**
 * 从所有目标包中模糊匹配给定的目标包名称
 * @param {ReadonlyArray<string>} partialTargets - 给定的目标包名称列表
 * @param {boolean | undefined} includeAllMatching - 是否返回所有匹配项
 * @returns {Array<string>} - 匹配的目标包名称列表
 */
export function fuzzyMatchTarget(partialTargets, includeAllMatching) {
  /** @type {Array<string>} */
  const matched = []
  partialTargets.forEach(partialTarget => {
    if (!includeAllMatching && allTargets.includes(partialTarget)) {
      matched.push(partialTarget)
      return
    }
    for (const target of allTargets) {
      if (target.match(partialTarget)) {
        matched.push(target)
        if (!includeAllMatching) {
          break    // 若未传入 includeAllMatching，只命中第一个匹配项
        }
      }
    }
  })
  if (matched.length) {
    return matched
  } else {
    console.log()    // 打印换行，确保美观
    console.error(
      `  ${pico.white(pico.bgRed(' ERROR '))} ${pico.red(
        `Target ${pico.underline(partialTargets.toString())} not found!`,
      )}`,
    )
    console.log()

    process.exit(1)
  }
}
