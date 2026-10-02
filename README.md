# Joplin Calm Mac

适用于 Joplin Desktop 3.7.18 及当前验证的 3.7.21 的本地界面主题插件。当前版本：**1.5.1**。

## 主要效果

- 三栏界面统一视觉层级，栏宽继续由 Joplin 原生拖动管理。
- 第一栏、笔记列表、正文、设置页和“移动到笔记本”弹窗采用同一套设计语言。
- 支持 Joplin 亮色、暗色及跟随系统模式。
- 提供“Calm Mac · 紧凑待办”和“Calm Mac · 分类预览”两种笔记列表样式。
- 正文标题、更新时间、归属信息和正文内容统一左侧基线。
- 不修改 `Joplin.app`，不读写 Joplin 的布局配置文件。

## 切换外观

1. 打开 Joplin 设置。
2. 进入“Calm Mac 外观”。
3. 在“界面样式”中选择“Calm Mac · 简洁样式”或“Joplin 默认外观”。
4. 点击“应用”或“确认”，然后完整退出并重新打开 Joplin。

明暗模式仍在 Joplin 的“外观”设置中控制。切换主题不会修改笔记、同步设置或栏宽。

## 项目结构

- `src/`：按界面组件拆分的 CSS 源码。
- `src/notifications.css`：成功、错误和信息提示浮层。
- `plugin/`：Joplin 插件入口、清单及构建生成的 CSS。
- `scripts/build.py`：合并 CSS 并生成 `.jpl` 安装包。
- `tests/`：插件逻辑、布局和侧栏状态回归测试。
- `validation/verification.md`：当前验证范围与已知限制。
- `MAINTENANCE.md`：后续修改约定和发布前检查清单。

根目录的 `userchrome.css`、`userstyle.css` 和 `plugin/userchrome.css` 均为生成文件；样式修改应写入 `src/*.css` 或 `plugin/userstyle.css`。

## 构建与测试

```sh
python3 scripts/build.py
node tests/plugin.cjs
node tests/layout.cjs
node tests/sidebar-selection.cjs
```

构建会生成与 `plugin/manifest.json` 版本一致的安装包。当前正式包为 `io.local.calm.mac.theme-1.5.1.jpl`。

## 最近修复

- 1.5.1：统一底部操作提示；使用主题表面色、低饱和状态色、紧凑排版和自适应明暗模式。
- 1.5.0：统一 ⌘P 快速跳转弹窗的宽度、搜索框、结果文字和选中样式；保留原生虚拟列表行高与键盘行为。
- 1.4.9：将正文列表标记调为 78% 文字色，兼顾清晰度与低干扰。
- 1.4.8：正文列表圆点和编号改为与文字同色，亮色与暗色模式自动适配。
- 1.4.7：提高正文水平分隔线的辨识度，并分别校准亮色与暗色模式的对比度。
- 1.4.6：移除 Markdown 源码编辑器的引用竖线，保留原始 `>` 标记和预览区引用样式。
- 1.4.5：重构明暗模式表格容器，补齐四边外框并降低表头和斑马纹的割裂感。
- 1.4.4：修复暗色模式下 Markdown 表格背景接近白色、文字对比度不足的问题。
- 1.4.3：修复回收站展开后标题行下移并与选中子项重叠的问题。
- 1.4.2：去掉“更新时间”和“归属于”之间由固定日期栏造成的大段空白。
- 1.4.1：统一笔记本、标签标题和具体标签的选中、悬停及焦点状态。
- 1.4.0：移除布局配置监听，拆分组件样式，完善缩略图缓存和自动回归测试。

## 兼容范围

主题以 Joplin 3.7.18 的界面结构为基准。Joplin 大版本升级后，应按 `MAINTENANCE.md` 重新检查明暗模式、设置页、弹窗、列表和标题元信息布局。原生分栏拖动的偶发回弹属于 Joplin 行为，本项目不通过修改客户端程序处理。

## 测试依赖

浏览器测试需要 Node.js、Playwright 和 Chromium：

```sh
npm install --no-save playwright
npx playwright install chromium
```

也可以设置 `PLAYWRIGHT_MODULE` 与 `CHROMIUM_PATH` 指向本地依赖。

## 许可证

本项目采用 MIT 许可证，见 LICENSE。
