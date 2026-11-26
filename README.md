# antigravity-oled-theme

基于 [antigravity-codex-theme](https://github.com/nkjDSLcvanv/antigravity-codex-theme) 的个人 **OLED 纯黑高对比极客主题配置包**，包含一键同步脚本与 ASCII / Unicode 架构图 2:1 严格对齐美化引擎。

## 特性一览

- **全窗纯黑 OLED 画布**：主区、侧栏、输入托盘统一压至 `#000000`，仅保留极细微边界线与 `#0B0B0E` 输入卡片。
- **高对比冷暖配色**：
  - 正文：`15px` 亮白 `#EDEDED`（恢复清晰笔画渲染）
  - 标题与 Markdown 加粗：暖琥珀金 `#FDB76B`（`700` 粗体）
  - 行内代码：去底色去边框，采用冷钢蓝 `#8EB2DC`（与暖琥珀金冷暖互补）
  - 用户发送消息气泡：极客暗蓝 `#0D1B2A` 底 + 亮冰蓝 `#B8D4F8` 字（自动兼容浅色模式）
- **分区字体方案**：
  - UI 界面：保留 Antigravity 原生 Google 字体
  - 对话正文：`JetBrains Mono`
  - 代码与架构图：`Maple Mono NF CN`（中英文严格 2:1 等宽）
- **ASCII / Unicode 架构图实时美化（`user/custom.js`）**：
  - 自动识别 `+---+`（ASCII）与 `┌───┐`（Unicode）框图（支持并排多盒与盒间连线如 `─G1►`）
  - 自动按东亚字符 2:1 宽度重新对齐边框并微扩溢出框线，消除 LLM 生成的中英列宽误差
  - ASCII 框线自动平滑升级为 Unicode 制表符（`┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ▼`），并按边框/箭头/阶段标题/任务路径分层着色
  - 锁定精确像素网格（`letter-spacing: 0`、`12.5px` / `10px` 整像素倍档），消除亚像素累积偏移
  - 不修改 React 原生节点，右上角提供 **「原文 / 美化」** 一键切换

## 前置依赖

1. 已安装 [antigravity-codex-theme](https://github.com/nkjDSLcvanv/antigravity-codex-theme)（Node.js `>= 22.13.0`）：
   ```bash
   git clone --depth=1 --filter=blob:none --sparse https://github.com/nkjDSLcvanv/antigravity-codex-theme.git
   cd antigravity-codex-theme
   git sparse-checkout set core user
   node install.mjs install
   ```
2. 本机安装推荐字体（macOS Homebrew）：
   ```bash
   brew install --cask font-jetbrains-mono font-maple-mono-nf-cn
   ```

## 快速使用

### 应用配置到本机 Antigravity（约 2.5 秒热重载生效）

```bash
git clone https://github.com/unirain/antigravity-oled-theme.git
cd antigravity-oled-theme
node sync.mjs apply
```

- 自动将旧配置备份至 `~/.gemini/antigravity/codex-theme/backups/user-profile-*`
- 自动保留你本机原有的 `sshHosts` 列表

### 将本机最新微调反向同步回仓库

```bash
node sync.mjs pull
```

- 自动拉取 `~/.gemini/antigravity/codex-theme/user/{config.json,custom.css,custom.js}`
- 自动清空 `sshHosts` 字段，避免将私密主机名误提交至公开仓库

## 文件结构

```text
antigravity-oled-theme/
├── user/
│   ├── config.json   # 分区字体、模块开关、额度样式与字号变量
│   ├── custom.css    # OLED 纯黑画布、冷暖配色、极客暗蓝气泡与 2:1 像素网格样式
│   └── custom.js     # ASCII / Unicode 架构图自动识别、2:1 对齐与制表线增强引擎
├── sync.mjs          # 双向同步脚本（apply / pull）
├── LICENSE           # MIT License
└── README.md
```
