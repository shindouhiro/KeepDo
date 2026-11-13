import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仅将环境变量名称写入生成工程，签名密码与密钥绝不进入源码。
const required = ['KEEPDO_ANDROID_KEYSTORE', 'KEEPDO_ANDROID_KEY_ALIAS', 'KEEPDO_ANDROID_STORE_PASSWORD', 'KEEPDO_ANDROID_KEY_PASSWORD']
for (const name of required) {
  if (!process.env[name]) throw new Error(`缺少 Android 签名环境变量：${name}`)
}
if (!isAbsolute(process.env.KEEPDO_ANDROID_KEYSTORE) || !existsSync(process.env.KEEPDO_ANDROID_KEYSTORE)) throw new Error('Android 签名密钥必须为已存在的绝对路径')
const path = fileURLToPath(new URL('../src-tauri/gen/android/app/build.gradle.kts', import.meta.url))
if (!existsSync(path)) throw new Error('请先运行 pnpm tauri android init')
const source = readFileSync(path, 'utf8')
const marker = '// KeepDo 环境签名配置'
if (!source.includes(marker)) {
  if (!source.includes('android {')) throw new Error('Android 工程结构已变化，请检查生成的 Gradle 配置')
  const block = `
    ${marker}
    signingConfigs {
        create("keepdoRelease") {
            storeFile = file(System.getenv("KEEPDO_ANDROID_KEYSTORE"))
            storePassword = System.getenv("KEEPDO_ANDROID_STORE_PASSWORD")
            keyAlias = System.getenv("KEEPDO_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("KEEPDO_ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("keepdoRelease")
        }
    }
`
  writeFileSync(path, source.replace('android {', `android {${block}`))
}
console.log('Android 发布签名已接入环境变量。')
