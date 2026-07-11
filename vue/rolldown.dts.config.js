// @ts-check
import { readdirSync } from 'node:fs'
import { dts } from 'rolldown-plugin-dts'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const packagesDir = path.resolve(__dirname, 'packages')

const packages = readdirSync('temp/packages')
// 可从环境变量获取指定 TARGETS，例如执行 TARGETS=reactivity,shared vp run build-types
const targets = process.env.TARGETS ? process.env.TARGETS.split(',') : null
const targetPackages = targets
  ? packages.filter(pkg => targets.includes(pkg))
  : packages

function resolveExternal(/**@type {string}*/ packageName) {
  const pkg = require(`${packagesDir}/${packageName}/package.json`)
  return [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]
}

export default targetPackages.map(
  /** @returns {import('rolldown').BuildOptions} */
  pkg => {
    return {
      input: `./temp/packages/${pkg}/src/index.d.ts`,
      output: {
        file: `packages/${pkg}/dist/${pkg}.d.ts`,
        format: 'es',
      },
      experimental: {
        nativeMagicString: true,
      },
      external: resolveExternal(pkg),
      plugins: [dts()],
    }
  },
)

