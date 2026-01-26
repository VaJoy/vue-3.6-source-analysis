import esbuild from 'esbuild'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {
    values: { format: rawFormat, prod, },
} = parseArgs({
    options: {
        format: {
            type: 'string',
            short: 'f',
            default: 'cjs',
        },
        prod: {
            type: 'boolean',
            short: 'p',
            default: false,
        },
    },
})

const format = rawFormat || 'cjs'
const outputFormat = format === 'cjs' ? 'cjs' : 'esm'

const pkgBasePath = `../packages/shared`
const outfile = resolve(__dirname, `${pkgBasePath}/dist/shared.${format}.${prod ? `prod.` : ``}js`)

const relativeOutfile = relative(process.cwd(), outfile)


/** @type {Array<import('esbuild').Plugin>} */
const plugins = [
    {
        name: 'log-rebuild',    // 在构建完成时，打印构建完成的文件路径
        setup(build) {
            build.onEnd(() => {
                console.log(`built: ${relativeOutfile}`)
            })
        },
    },
]

const entry = 'index.ts'

esbuild
    .context({
        entryPoints: [resolve(__dirname, `${pkgBasePath}/src/${entry}`)],
        outfile,
        bundle: true,
        sourcemap: true,
        format: outputFormat,
        platform: format === 'cjs' ? 'node' : 'browser',
        plugins,
        define: {
            __DEV__: prod ? `false` : `true`,
        },
    })
    .then(ctx => ctx.watch())

