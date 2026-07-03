// @ts-check

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 获取传入包名的源码入口绝对路径
const resolveEntryForPkg = (/** @type {string} */ p) =>
  path.resolve(
    fileURLToPath(import.meta.url),
    `../../packages/${p}/src/index.ts`,
  )

// 读取 packages 目录下所有文件和子文件夹
const dirs = readdirSync(new URL('../packages', import.meta.url))

/** @type {Record<string, string>} */
const entries = {}

for (const dir of dirs) {
  const key = `@vue/${dir}`
  if ( statSync(new URL(`../packages/${dir}`, import.meta.url)).isDirectory() ) {
    entries[key] = resolveEntryForPkg(dir)
  }
}

export { entries }
