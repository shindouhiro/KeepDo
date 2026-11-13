import { defineConfig } from 'bumpp'

export default defineConfig({
  files: ['package.json', 'extension/manifest.json'],
  commit: 'chore: 发布 v{version}',
  tag: 'v{version}',
  push: true,
  noGitCheck: false,
  execute: 'pnpm release:check',
})
