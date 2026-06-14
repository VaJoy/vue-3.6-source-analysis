import { defineConfig } from "vite-plus";

export default defineConfig({
  /** 配置 Staged 规则 **/
  staged: {
    'vue/*.{js,json}': ['vp fmt --no-error-on-unmatched-pattern'],
    'vue/*.ts?(x)': ['vp lint --fix', 'vp fmt --no-error-on-unmatched-pattern'],
  }
})