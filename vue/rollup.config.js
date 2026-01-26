import { fileURLToPath } from 'node:url'
import path from 'node:path'
import esbuild from 'rollup-plugin-esbuild'
import replace from '@rollup/plugin-replace'

/**
 * @template T
 * @template {keyof T} K
 * @typedef { Omit<T, K> & Required<Pick<T, K>> } MarkRequired
 */
/** @typedef {'cjs' | 'esm-bundler' | 'global' | 'global-runtime' | 'esm-browser' | 'esm-bundler-runtime' | 'esm-browser-runtime' | 'esm-browser-vapor'} PackageFormat */
/** @typedef {MarkRequired<import('rollup').OutputOptions, 'file' | 'format'>} OutputOptions */

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** @type {Record<PackageFormat, OutputOptions>} */
const outputConfigs = {
	'esm-bundler': {
		file: path.resolve(__dirname, './packages/shared/dist/shared.esm-bundler.js'),
		format: 'es',
	},
	cjs: {
		file: path.resolve(__dirname, './packages/shared/dist/shared.cjs.js'),
		format: 'cjs',
	},
}

const packageFormats = ['esm-bundler', 'cjs']

const packageConfigs = process.env.PROD_ONLY ? [] : packageFormats.map(format => createConfig(format, outputConfigs[format]))

if (process.env.NODE_ENV === 'production') {
	packageFormats.forEach(format => {
		if (format === 'cjs') {
			packageConfigs.push(createProductionConfig(format))
		}
	})
}

export default packageConfigs

/**
 *
 * @param {PackageFormat} format
 * @param {OutputOptions} output
 * @param {ReadonlyArray<import('rollup').Plugin>} plugins
 * @returns {import('rollup').RollupOptions}
 */
function createConfig(format, output, plugins = []) {
	const isProductionBuild = /\.prod\.js$/.test(output.file)
	const isBundlerESMBuild = /esm-bundler/.test(format)

	console.log(`正在创建${isProductionBuild ? '生产环境' : '开发环境'} ${format} 格式的构建配置...`)

	return {
		input: path.resolve(__dirname, './packages/shared/src/index.ts'),
		plugins: [       
			...resolveReplace(),
			esbuild({ 
				tsconfig: path.resolve(__dirname, 'tsconfig.json'),
				minify: false,
				target: 'es2016',
				define: resolveDefine(),
			}),
			...plugins
		],
		output,
		treeshake: {
			moduleSideEffects: false,
		},
	}

	function resolveDefine() {
		const replacements = {}

		if (!isBundlerESMBuild) {
			replacements.__DEV__ = String(!isProductionBuild)
		}

		return replacements
	}

	function resolveReplace() {
		const replacements = {}

		if (isBundlerESMBuild) {
			Object.assign(replacements, {
				__DEV__: `!!(process.env.NODE_ENV !== 'production')`,
			})
		}

		return [replace({ values: replacements, preventAssignment: true })]
	}
}

function createProductionConfig(/** @type {PackageFormat} */ format) {
	return createConfig(format, {
		...outputConfigs[format],
		file: path.resolve(__dirname, './packages/shared/dist/shared.cjs.prod.js'),
	})
}