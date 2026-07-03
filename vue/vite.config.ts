import { defineConfig } from 'vite-plus'
import { entries } from './scripts/aliases.js'

export default defineConfig({
  /** 宏定义 **/
  define: {
    __DEV__: process.env.MODE !== 'benchmark',
    __TEST__: true,
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: true,
  },
  /** 别名配置 **/
  resolve: {
    alias: entries,
  },
  /** Vitest 配置 **/
  test: {
    globals: true, // 开启全局 API 能力的支持
  },

  /** 配置 Staged 规则 **/
  staged: {
    '*.{js,json}': ['vp fmt --no-error-on-unmatched-pattern'],
    '*.ts?(x)': ['vp lint --fix', 'vp fmt --no-error-on-unmatched-pattern'],
  },

  /** 配置 Lint 规则 **/
  lint: {
    categories: {
      correctness: 'off', // 关闭 correctness 类别的规则（参考 https://oxc.rs/docs/guide/usage/linter/rules.html）
    },
    env: {
      builtin: true, // 允许使用内建运行时环境提供的全局对象（例如 console、Promise 等）
    },
    ignorePatterns: ['**/dist/'], // 忽略的文件或目录
    overrides: [
      // 覆盖默认规则（https://eslint.org/docs/latest/rules/）
      {
        files: ['**/*.js', '**/*.ts', '**/*.tsx'],
        rules: {
          'no-debugger': 'error', // 禁止在生产代码中使用 debugger 语句，出现即报错
          'no-console': [
            // 禁止使用 console.log、console.table 等，但可以保留 console.warn、console.error、console.info
            'error',
            {
              allow: ['warn', 'error', 'info'],
            },
          ],
          'no-restricted-globals': [
            // 禁止使用 window、document、module、require 全局对象，目的是强制开发者使用模块化的方式（import/export）、在浏览器环境中避免直接操作 DOM 全局变量
            'error',
            'window',
            'document',
            'module',
            'require',
          ],
          'sort-imports': [
            // 不强制对多个 import 语句进行排序，但仍会检查单个 import 内部的成员排序（比如 import { b, a } from 'x'，需改成 a, b）
            'error',
            {
              ignoreDeclarationSort: true,
            },
          ],
          '@typescript-eslint/prefer-ts-expect-error': 'error', // 推荐使用 @ts-expect-error 进行注释，而不是 @ts-ignore
          '@typescript-eslint/consistent-type-imports': [
            'error',
            {
              fixStyle: 'inline-type-imports', // 将 import type { ... } 转换为 import { type ... }
              disallowTypeAnnotations: false, // 允许在值导入中使用 type 注解，例如 import { Foo, type Bar }
            },
          ],
          '@typescript-eslint/no-import-type-side-effects': 'error', // 禁止带有副作用的 import type 语句，例如 import type './side-effect' 或 import type * as foo from './mod'
        },
      },
      {
        files: ['packages/shared/**'],
        rules: {
          'no-restricted-globals': 'off', // 允许使用 window、document 等全局对象
        },
      },
      {
        files: ['*.js'],
        rules: {
          'no-unused-vars': [
            'error',
            {
              vars: 'all', // 检查所有变量是否被使用
              args: 'none', // 不检查函数参数是否被使用
            },
          ],
        },
      },
      {
        files: ['scripts/**', './*.{js,ts}', 'packages/*/*.js'],
        rules: {
          'no-restricted-globals': 'off', // 允许使用 window、document 等全局对象
          'oxc/no-const-enum': 'error', // 禁止使用 const enum，因为 const enum 在 isolatedModules 开启时，某些打包工具会引发问题（被内联后类型丢失或导入错误）
          'no-console': 'off', // 允许使用 console
        },
      },
    ],
  },

  /** 配置格式化规则 **/
  fmt: {
    semi: false, // 末尾不加分号
    singleQuote: true, // 字符串使用单引号
    arrowParens: 'avoid', // 箭头函数参数只有一个时，不使用括号
    printWidth: 80, // 按每行最多 80 个字符的宽度排版，超过时换行
    experimentalSortPackageJson: false, // 不对 package.json 里的键序重新排序
    ignorePatterns: ['dist', 'CHANGELOG*.md', '*.toml'], // 忽略的文件或目录
  },
})
