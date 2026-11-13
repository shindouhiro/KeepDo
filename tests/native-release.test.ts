import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { nativePackages, planNativeAssets, releaseVersion, validateNativeRun } from '../scripts/lib/native-release.mjs'

test('发布拒绝错误仓库、分支、工作流和未成功构建，仅接受指定标签', () => {
  const repository = 'shindouhiro/KeepDo'
  const run = {
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    path: '.github/workflows/native.yml',
    event: 'push',
    head_branch: 'v1.0.2',
    status: 'completed',
    conclusion: 'success',
  }
  assert.doesNotThrow(() => validateNativeRun(run, 'v1.0.2', repository))
  for (const patch of [
    { head_repository: { full_name: 'other/KeepDo' } },
    { repository: { full_name: 'other/KeepDo' } },
    { path: '.github/workflows/extension.yml' },
    { event: 'pull_request' },
    { head_branch: 'main' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
  ]) {
    assert.throws(() => validateNativeRun({ ...run, ...patch }, 'v1.0.2', repository))
  }
  assert.equal(releaseVersion('native-v1.0.2'), '1.0.2')
  for (const tag of ['main', 'v1.0.2/../../other', 'v1.0.2;echo unsafe', 'v1.0.2-beta']) {
    assert.throws(() => releaseVersion(tag))
  }
})

test('发布收集七类最终安装包，拒绝缺失、重复、空文件与符号链接', () => {
  const root = mkdtempSync(join(tmpdir(), 'keepdo-release-'))
  try {
    for (const item of nativePackages) {
      const directory = join(root, item.artifact, 'bundle')
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, `package${item.extension}`), '已构建安装包')
    }
    const plan = planNativeAssets(root, 'v1.0.2')
    assert.equal(plan.length, 7)
    assert.equal(new Set(plan.map(item => item.name)).size, 7)
    assert.ok(plan.every(item => item.name.startsWith('KeepDo_1.0.2_')))
    const apk = join(root, 'keepdo-android-arm64-debug', 'bundle', 'package.apk')
    writeFileSync(apk, '')
    assert.throws(() => planNativeAssets(root, 'v1.0.2'), /非空/)
    rmSync(apk)
    symlinkSync(plan[0].source, apk)
    assert.throws(() => planNativeAssets(root, 'v1.0.2'), /必须包含/)
    rmSync(apk)
    writeFileSync(apk, '恢复安装包')
    const duplicate = join(root, 'keepdo-android-arm64-debug', 'duplicate.apk')
    writeFileSync(duplicate, '重复安装包')
    assert.throws(() => planNativeAssets(root, 'v1.0.2'), /仅包含一个/)
    rmSync(duplicate)
    rmSync(apk)
    assert.throws(() => planNativeAssets(root, 'v1.0.2'), /必须包含/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
