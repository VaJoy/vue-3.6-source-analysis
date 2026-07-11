// @ts-check

import { rolldown } from 'rolldown'
import { parseArgs } from 'node:util'
import path from 'node:path'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import pico from 'picocolors'
import { allTargets, fuzzyMatchTarget } from './utils.js'
import { createConfigsForPackage } from './create-rolldown-config.js'
import { fileURLToPath } from 'node:url'
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const { values, positionals: targets } = parseArgs({
  allowPositionals: true,
  options: {
    formats: {
      type: 'string',
      short: 'f',
    },
    devOnly: {
      type: 'boolean',
      short: 'd',
    },
    prodOnly: {
      type: 'boolean',
      short: 'p',
    },
    withTypes: {
      type: 'boolean',
      short: 't',
    },
    sourceMap: {
      type: 'boolean',
      short: 's',
    },
    all: {
      type: 'boolean',
      short: 'a',
    },
  },
})

const {
  formats: rawFormats,
  all: buildAllMatching,
  devOnly,
  prodOnly,
  withTypes: buildTypes,
  sourceMap,
} = values

/**
 * @type {string[] | undefined}
 */
let formats
let isNegation = false
if (rawFormats) {
  isNegation = rawFormats.startsWith('~') // 是否取反。后续创建 Rolldown 配置时会用到
  formats = (isNegation ? rawFormats.slice(1) : rawFormats).split('+')
}

run()

async function run() {
  const resolvedTargets = targets.length
    ? fuzzyMatchTarget(targets, buildAllMatching)
    : allTargets
  if (buildTypes) {
    await import('./build-types.js')
  }
  await buildAll(resolvedTargets)
}

/**
 * 异步构建所有目标包
 * @param {Array<string>} targets - 目标包名称列表
 * @returns {Promise<void>}
 */
async function buildAll(targets) {
  const start = performance.now()
  const all = []
  let count = 0
  for (const t of targets) {
    const configs = createConfigsForTarget(t) // 创建目标包的 Rolldown 配置
    if (configs) {
      all.push(
        Promise.all(
          configs.map(c => {
            return rolldown(c).then(bundle => {
              // @ts-expect-error
              return bundle.write(c.output).then(() => {
                // 调用 Rolldown 接口执行构建。API 参考 https://rolldown.rs/apis/bundler-api
                // @ts-expect-error
                return c.output.file
              })
            })
          }),
        ).then(files => {
          const from = process.cwd()
          files.forEach((/** @type {string} */ f) => {
            count++
            console.log(
              pico.gray('built: ') + pico.green(path.relative(from, f)),
            )
          })
        }),
      )
    }
  }
  await Promise.all(all)
  console.log(
    `\n${count} files built in ${(performance.now() - start).toFixed(2)}ms.`,
  )
}

/**
 * 针对指定的目标包创建 rolldown 构建配置
 * @param {string} target - 目标包的名称
 * @returns {import('rolldown').RolldownOptions[] | void} - 构建配置数组或 void
 */
function createConfigsForTarget(target) {
  const pkgDir = path.resolve(__dirname, `../packages/${target}`)
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf-8'))

  let resolvedFormats
  if (formats) {
    const pkgFormats = pkg.buildOptions?.formats
    if (pkgFormats) {
      if (isNegation) {
        // 取反（用户传入的构建格式内容以波浪符 ~ 开头）处理
        resolvedFormats = pkgFormats.filter(
          (/** @type {string} */ f) => !formats.includes(f),
        )
      } else {
        resolvedFormats = formats.filter(f => pkgFormats.includes(f))
      }
    }
    if (!resolvedFormats.length) {
      return
    }
  }

  // 指定构建格式时，先删除已有的 dist 文件夹，避免遗留前次构建的其它格式产物
  if (!formats && existsSync(`${pkgDir}/dist`)) {
    rmSync(`${pkgDir}/dist`, { recursive: true })
  }

  return createConfigsForPackage({
    target,
    pkg,
    formats: resolvedFormats,
    prodOnly,
    devOnly,
    sourceMap,
  })
}
