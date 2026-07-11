// @ts-check

import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { watch } from 'rolldown'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const {
  values: { format: rawFormat, prod },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'global',
    },
    prod: {
      type: 'boolean',
      short: 'p',
      default: false,
    },
  },
})

const format = rawFormat || 'global'
const targets = positionals.length ? positionals : ['shared']

const outputFormat = format.startsWith('global') ? 'iife'  : (format === 'cjs' ? 'cjs'  : 'es')

const postfix = format.endsWith('-runtime') ? `runtime.${format.replace(/-runtime$/, '')}` : format

for (const target of targets) {
  const pkgBasePath = `../packages/${target}`
  const pkg = require(`${pkgBasePath}/package.json`)
  const outfile = resolve(
    __dirname,
    `${pkgBasePath}/dist/${target}.${postfix}.${prod ? `prod.` : ``}js`,
  )
  const relativeOutfile = relative(process.cwd(), outfile)

  /** @type {string[]} */
  let external = []
  // 裁剪外部依赖，非浏览器的构建不要把依赖模块的代码内联进构建产物中
  if (format === 'cjs' || format.includes('esm-bundler')) {
    external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]
  }

  /** @type {import('rolldown').Plugin[]} */
  const plugins = []

  const platform = format === 'cjs' ? 'node' : 'browser'

  /** @type {import('rolldown').WatchOptions} */
  const config = {
    input: resolve(__dirname, `${pkgBasePath}/src/index.ts`),
    output: {
      file: outfile,
      format: outputFormat,
      sourcemap: true,
      name: pkg.buildOptions?.name,
    },
    external,
    platform,
    treeshake: {
      moduleSideEffects: false,
    },
    plugins,
    transform: {
      define: {
        __VERSION__: `"${pkg.version}"`,
        __DEV__: prod ? `false` : `true`,
        __TEST__: `false`,
        __BROWSER__: String(format !== 'cjs'),
        __GLOBAL__: String(format === 'global'),
        __ESM_BUNDLER__: String(format.includes('esm-bundler')),
        __ESM_BROWSER__: String(format.includes('esm-browser')),
        __CJS__: String(format === 'cjs'),
      },
    },
  }

  console.log(`watching: ${relativeOutfile}`)

  // 调用 Rolldown 的 watch 接口监听本地改动，实时触发构建
  watch(config).on('event', event => {
    if (event.code === 'BUNDLE_END') {
      // @ts-expect-error
      console.log(`built ${config.output.file} in ${event.duration}ms`)
    }
  })
}
