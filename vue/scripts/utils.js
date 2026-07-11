// @ts-check
import fs from 'node:fs'
import pico from 'picocolors'
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawn } from 'node:child_process'

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

/**
 * @param {string} command
 * @param {ReadonlyArray<string>} args
 * @param {object} [options]
 * @returns {Promise<{ ok: boolean, code: number | null, stderr: string, stdout: string }>}
 */
export async function exec(command, args, options) {
  return new Promise((resolve, reject) => {
    // 1. 启动子进程
    const _process = spawn(command, args, { 
      stdio: [
        'ignore', // stdin 配置，默认不会读取输入（适合非交互命令，避免等候不必要的输入而卡住）
        'pipe',   // stdout 配置，默认标准输出通过管道回流到当前 Node 进程，由脚本自己读取（stdoutChunks）
        'pipe',   // stderr 配置，默认错误输出也通过管道回流，由脚本自己读取（stderrChunks）
      ],
      ...options,
      shell: process.platform === 'win32',  // 兼容处理，针对 Windows 启用 shell
    })

    // 2. 收集输出
    /**
     * @type {Buffer[]}
     */
    const stderrChunks = []
    /**
     * @type {Buffer[]}
     */
    const stdoutChunks = []

    _process.stderr?.on('data', chunk => {
      stderrChunks.push(chunk)
    })

    _process.stdout?.on('data', chunk => {
      stdoutChunks.push(chunk)
    })

    _process.on('error', error => {
      reject(error)
    })

    // 3. 判断结果并返回
    _process.on('exit', code => {
      const ok = code === 0
      const stderr = Buffer.concat(stderrChunks).toString().trim()
      const stdout = Buffer.concat(stdoutChunks).toString().trim()

      if (ok) {
        const result = { ok, code, stderr, stdout }
        resolve(result)
      } else {
        reject(
          new Error(
            `Failed to execute command: ${command} ${args.join(' ')}: ${stderr}`,
          ),
        )
      }
    })
  })
}