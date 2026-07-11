// @ts-check
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { entries } from './aliases.js'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const masterVersion = require('../package.json').version  // 版本号，统一取项目根目录包配置中的 version

const packagesDir = path.resolve(__dirname, '../packages')

/** @typedef {'cjs' | 'esm-bundler' | 'global' | 'esm-browser' } PackageFormat */

/**
 * @param {{
 *   target: string
 *   pkg: any,
 *   formats?: PackageFormat[]
 *   devOnly?: boolean
 *   prodOnly?: boolean
 *   sourceMap?: boolean
 * }} options
 */
export function createConfigsForPackage({
  target,
  pkg,
  formats,
  devOnly = false,
  prodOnly = false,
  sourceMap = false,
}) {

  const packageDir = path.resolve(packagesDir, target)
  const resolve = (/** @type {string} */ p) => path.resolve(packageDir, p)
  const packageOptions = pkg.buildOptions || {}
  const name = path.basename(packageDir)

  const banner = `/**
  * ${pkg.name} v${masterVersion}
  * (c) 2018-present Vue
  * @license MIT
  **/`

  /** @type {Record<PackageFormat, import('rolldown').OutputOptions>} */
  const outputConfigs = {
    'esm-bundler': {
      file: resolve(`dist/${name}.esm-bundler.js`),
      format: 'es',
    },
    'esm-browser': {
      file: resolve(`dist/${name}.esm-browser.js`),
      format: 'es',
    },
    cjs: {
      file: resolve(`dist/${name}.cjs.js`),
      format: 'cjs',
    },
    global: {
      file: resolve(`dist/${name}.global.js`),
      format: 'iife',
    },
  }

  /** @type {PackageFormat[]} */
  const resolvedFormats = (
    formats ||
    packageOptions.formats || ['esm-bundler', 'cjs']
  ).filter((/** @type {PackageFormat} */ format) => outputConfigs[format])

  const packageConfigs = prodOnly
    ? []  // 仅构建生产环境的配置可以先置空（因为不需要生成开发环境配置）
    : resolvedFormats.map(format => createConfig(format, outputConfigs[format]))

  if (!devOnly) {    // 「仅构建生产环境」和「同时构建生产环境和开发环境」，等价于「需要构建生产环境」的场景
    resolvedFormats.forEach(format => {
      if (format === 'cjs') {
        packageConfigs.push(createProductionConfig(format))
      }
      if (/^(global|esm-browser)$/.test(format)
      ) {
        packageConfigs.push(createProductionConfig(format, true))  // 面向浏览器的构建物需要进行压缩
      }
    })
  }

  /**
   * 创建基础配置（等价于创建开发环境配置）
   * @param {PackageFormat} format
   * @param {import('rolldown').OutputOptions} output
   * @returns {import('rolldown').RolldownOptions}
   */
  function createConfig(format, output) {
    const isProductionBuild = /\.prod\.js$/.test(String(output.file) || '')
    const isBundlerESMBuild = /esm-bundler/.test(format)
    const isBrowserESMBuild = /esm-browser/.test(format)
    const isCJSBuild = format === 'cjs'
    const isGlobalBuild = /global/.test(format)
    const isBrowserBuild =
      (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
      !packageOptions.enableNonBrowserBranches

    output.postBanner = banner  // 在构建产物头部固定的横幅内容

    // 强制将模块的导出打包为 CJS 的属性（即键值对对象），提高「构建工具在处理 ESM+CJS 混用项目时」的兼容性
    output.exports = 'named'

    if (isCJSBuild) {
      // 为生成的导出的对象（module.exports）添加一个 __esModule: true 的属性，以标识「该 CJS 文件由 ESM 转换而来」
      output.esModule = true
    }
    output.sourcemap = sourceMap

    output.externalLiveBindings = false  // 关闭动态绑定特性（不使用 Object.defineProperty 来定义导入模块的属性），减少构建产物体积

    if (isGlobalBuild) {
      output.name = packageOptions.name  // 指定 global 构建产物中的全局变量名
    }

    function resolveDefine() {
      /** @type {Record<string, string>} */
      const defines = {
        __VERSION__: `"${masterVersion}"`,
        __TEST__: `false`,
        __BROWSER__: String(isBrowserBuild),
        __GLOBAL__: String(isGlobalBuild),
        __ESM_BUNDLER__: String(isBundlerESMBuild),
        __ESM_BROWSER__: String(isBrowserESMBuild),
        __CJS__: String(isCJSBuild),
        __DEV__: isBundlerESMBuild
          ? `!!(process.env.NODE_ENV !== 'production')`
          : String(!isProductionBuild),
      }

      // 允许在命令行中手动输入环境变量来覆盖默认的 define 定义，例如
      // __DEV__=true vp run build
      Object.keys(defines).forEach(key => {
        if (key in process.env) {
          const value = process.env[key]
          assert(typeof value === 'string')
          defines[key] = value
        }
      })

      return defines
    }

    // 裁剪外部依赖，非浏览器的构建不要把依赖模块的代码内联进构建产物中
    function resolveExternal() {
      if (!isGlobalBuild && !isBrowserESMBuild) {
        // 非面向浏览器的构建，外部化所有依赖项
        return [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.peerDependencies || {}),
        ]
      }
    }

    return {
      input: resolve('src/index.ts'),
      external: resolveExternal(),
      transform: {
        define: resolveDefine(),
        target: isCJSBuild ? 'es2019' : 'es2016',
      },
      platform:
        format === 'cjs' ? 'node' : isBundlerESMBuild ? 'neutral' : 'browser',
      resolve: {
        alias: entries,
      },
      output,
      treeshake: {
        moduleSideEffects: false,  // 声明所有模块没有副作用，Tree-shaking 时会移除所有导出了但未使用的模块
      },
      experimental: {
        nativeMagicString: true,   // 启用 Rust 原生实现的 MagicString 来大幅提升 SourceMap 生成性能
      },
    }
  }

  /** 创建生产环境配置（基于 createConfig 的开发环境配置上做修改）**/
  function createProductionConfig(/** @type {PackageFormat} */ format, minify = false) {
    return createConfig(format, {
      file: resolve(`dist/${name}.${format}.prod.js`),
      format: outputConfigs[format].format,
      minify,
    })
  }

  return packageConfigs
}
