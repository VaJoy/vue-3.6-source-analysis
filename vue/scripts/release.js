// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import pico from 'picocolors'
import semver from 'semver'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { exec, } from './utils.js'
import { parseArgs } from 'node:util'
import enquirer from 'enquirer'    // enquirer 是 CommonJS 模块，无法直接写作 import { prompt } from 'enquirer'
const { prompt } = enquirer

/**
 * @typedef {{
 *   name: string
 *   version: string
 *   dependencies?: { [dependenciesPackageName: string]: string }
 *   peerDependencies?: { [peerDependenciesPackageName: string]: string }
 * }} Package
 */

let versionUpdated = false

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    preid: {                // 预发布类型标识符，例如 alpha、beta、rc
      type: 'string',
    },
    tag: {
      type: 'string',       // 发布标签
    },
    skipBuild: {
      type: 'boolean',
    },
    skipPrompts: {
      type: 'boolean',
    },
  },
})

let currentVersion = createRequire(import.meta.url)('../package.json').version
const originalVersion = currentVersion

// 预发布类型标识符，例如 alpha、beta、rc（若为正式版，值为 undefined）
const preId = args.preid || semver.prerelease(currentVersion)?.[0]  // semver.prerelease('3.6.0-beta.17') 返回 ['beta', 17]；semver.prerelease('3.6.0') 返回 null
// 根据发布类型生成新的语义版本
const inc = (/** @type {import('semver').ReleaseType} */ i) => semver.inc(currentVersion, i, String(preId ?? ''))  // semver.inc('3.6.0', 'patch') => "3.6.1"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => {
    const pkgRoot = path.resolve(__dirname, '../packages', p)
    const pkgPath = path.resolve(pkgRoot, 'package.json')
    if (!fs.statSync(pkgRoot).isDirectory() || !fs.existsSync(pkgPath)) {
      return false // 过滤空包
    }

    return true
  })

// 获取指定包的绝对路径
const getPkgRoot = (/** @type {string} */ pkg) =>
  path.resolve(__dirname, '../packages/' + pkg)

const step = (/** @type {string} */ msg) => console.log(pico.cyan(msg))

const getPkgManifest = (/** @type {string} */ pkg) =>
  /** @type {Package} */ (
    JSON.parse(
      fs.readFileSync(path.resolve(getPkgRoot(pkg), 'package.json'), 'utf-8'),
    )
  )

const run = async (
  /** @type {string} */ bin,
  /** @type {ReadonlyArray<string>} */ args,
  /** @type {import('node:child_process').SpawnOptions} */ opts = {},
) => exec(bin, args, { stdio: 'inherit', ...opts })

// 发布类型名称列表
/** @type {ReadonlyArray<import('semver').ReleaseType>} */
const versionIncrements = [
  'patch', 'minor', 'major',
  ...(preId ?  /** @type {const} */ (['prepatch', 'preminor', 'premajor', 'prerelease']) : []),  // 若属于预发布，补充更多预发布相关的选项
]

async function main() {
  let targetVersion = positionals[0]

  if (!targetVersion) {
    /** @type {{ release: string }} */
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements
        .map(i => `${i} (${inc(i)})`)
        .concat(['custom']),
    })

    if (release === 'custom') {
      /** @type {{ version: string }} */
      const result = await prompt({
        type: 'input',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion,
      })
      targetVersion = result.version
    } else {
      targetVersion = release.match(/\((.*)\)/)?.[1] ?? ''
    }
  }

  // @ts-expect-error
  if (versionIncrements.includes(targetVersion)) {
    // 如果输入的是发布类型，调用 inc 函数生成新的语义版本
    // @ts-expect-error
    targetVersion = inc(targetVersion)  
  }

  updateVersions(targetVersion)

  // 生成 CHANGELOG 文件
  step('\nGenerating changelog...')
  await run('vp', ['run', 'changelog'])

  step('\nUpdating lockfile...')
  await run('vp', ['install', '--prefer-offline'])  // 在版本号更新后，需同步修改 pnpm-lock.yaml，把当前依赖解析结果固定下来

  await buildPackages()
  await publishPackages(currentVersion)

  console.log(`targetVersion is: ${targetVersion} \n`)
}

/**
 * 更新各包 package.json 中的 version
 * @param {string} version
 */
function updateVersions(version) {
  versionUpdated = true
  currentVersion = version
  updatePackage(path.resolve(__dirname, '..'), version)  // 同步修改项目根目录的包配置版本号
  packages.forEach(p => updatePackage(getPkgRoot(p), version))
}

/**
 * @param {string} pkgRoot
 * @param {string} version
 */
function updatePackage(pkgRoot, version) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  /** @type {Package} */
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

// 构建，执行指令 vp run build --withTypes
async function buildPackages() {
  step('\nBuilding all packages...')
  if (!args.skipBuild) {
    await run('vp', ['run', 'build', '--withTypes'])
  } else {
    console.log(`(skipped)`)
  }
}

/**
 * 遍历所有包，通过 publishPackage 方法执行发包
 * @param {string} version
 */
async function publishPackages(version) {
  step('\nPublishing packages...')

  for (const pkg of packages) {
    await publishPackage(pkg, version)
  }
}

/**
 * @param {string} pkgName
 * @param {string} version
 */
async function publishPackage(pkgName, version) {
  const packageName = getPkgManifest(pkgName).name

  let releaseTag = null
  if (args.tag) {
    releaseTag = args.tag
  } else if (version.includes('alpha')) {
    releaseTag = 'alpha'
  } else if (version.includes('beta')) {
    releaseTag = 'beta'
  } else if (version.includes('rc')) {
    releaseTag = 'rc'
  }

  step(`Publishing ${packageName}...`)
  try {
    await run(
      'vp',
      [
        'exec',
        'pnpm',
        'publish',
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public',
      ],
      {
        cwd: getPkgRoot(pkgName),
        stdio: 'pipe',
      },
    )
    console.log(pico.green(`Successfully published ${packageName}@${version}`))
  } catch (/** @type {any} */ e) {
    if (e.message?.match(/previously published/)) {
      console.log(pico.red(`Skipping already published: ${packageName}@${version}`))  // 提示该包已发布过
    } else {
      throw e
    }
  }
}

main().catch(err => {
  if (versionUpdated) {
    // 若更新过版本号，需要将其重置
    updateVersions(originalVersion)
  }
  console.error(err)
  process.exit(1)
})
