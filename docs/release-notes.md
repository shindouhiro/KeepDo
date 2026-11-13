从下方 **Assets** 下载对应平台的安装包。原生附件在标签构建与发布步骤全部成功后提供，可通过仓库 Actions 查看进度。

| 文件 | 用途 |
| --- | --- |
| `*macos_arm64.dmg` | macOS Apple Silicon，最低 macOS 14.4 |
| `*macos_x64.dmg` | macOS Intel，最低 macOS 14.4 |
| `*windows_x64_setup.exe` | Windows x64 安装器，需要 WebView2 |
| `*linux_x64.AppImage` / `*linux_amd64.deb` | Linux x64，需要兼容的 WebKitGTK 与 Secret Service |
| `*android_arm64_debug.apk` | Android arm64 调试安装包，最低 API 24 |
| `*ios_arm64_simulator.zip` | iOS arm64 模拟器归档，最低 iOS 17.4，不能安装到真机 |
| `SHA256SUMS-native.txt` | 原生附件的 SHA-256 校验和 |
| `dist-extension.zip` | Chrome 扩展，扩展构建成功后提供 |

当前原生包用于测试：Windows/macOS 尚未配置正式发行签名或 macOS 公证；Android 使用调试签名，iOS 仅提供模拟器归档。正式签名与真机分发说明见仓库的 `docs/native.md`。

客户端需要联网，默认连接 [KeepDo 在线服务](https://keepdo.shindouhiro.workers.dev)，共用账号和云端数据。Web 可直接通过上述链接使用。

Chrome 扩展安装：解压 `dist-extension.zip`，在 `chrome://extensions/` 启用「开发者模式」，点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的目录。
