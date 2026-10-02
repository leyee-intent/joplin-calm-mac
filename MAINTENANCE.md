# Calm Mac 维护说明

## 修改入口

- `src/tokens.css`：全局颜色变量。
- `src/base.css`：字体、全局焦点和滚动条。
- `src/sidebar.css`：侧栏层级、选中状态、同步和回收站。
- `src/list.css`：笔记列表、搜索、新建和排序控件。
- `src/editor.css`：正文容器、标题、更新时间、归属、状态栏。
- `src/settings.css`：设置导航与表单。
- `src/picker.css`：笔记本下拉弹窗。
- `src/goto.css`：⌘P 快速跳转弹窗；保持原生虚拟列表行高。
- `src/notifications.css`：底部操作提示浮层及撤销按钮。
- `src/icons.css`：图标掩膜。
- `src/responsive.css`：设置页窄窗口规则。
- `plugin/userstyle.css`：富文本和渲染正文。
- `plugin/index.js`：主题开关、两个列表渲染器、缩略图缓存。

`plugin/userchrome.css` 和根目录的 CSS 是生成文件。不要在它们末尾继续堆积补丁。

## 构建与测试

```sh
python3 scripts/build.py
node --check plugin/index.js
node tests/plugin.cjs
node tests/layout.cjs
```

布局测试需要 Playwright 和 Chromium。可用 `PLAYWRIGHT_MODULE`、`CHROMIUM_PATH` 指定环境路径；默认使用标准 Playwright 模块及其 Chromium。插件安装包本身不依赖这些测试工具。

测试输出在 `validation/`。示例页面只包含合成内容，不复制用户笔记。

## 设计和兼容约定

1. 栏宽完全由 Joplin 原生管理。插件不读写 settings.json，不安装文件监听器，不设置 CSS 最小宽度。旧版本保存的 minWidth 可暂时残留，随后由 Joplin 的原生布局保存覆盖；不再主动维护它。
2. 所有行高必须和注册的虚拟列表 itemSize 一致。紧凑 36px、预览 84px；不要单独用 CSS 改行高。
3. 颜色跟随 Joplin 当前主题。系统自动明暗仍使用 Joplin 的设置。
4. `!important` 用于覆盖原生内联或高优先级样式；不以机械减少数量为目标。合并组件定义时必须验证选中、悬停、键盘焦点。
5. 元数据 CSS 基于 Joplin 3.7.18 的结构：最多三个标题前提示块，之后为标题、可选归属、正文、辅助区、状态栏和搜索区。该结构不是稳定插件 API，升级后必须复核。
6. 原生 React-select 的类名后缀仍是下拉选择器的样式挂点。保留原生键盘行为，不替换组件。
7. 不修改 Joplin.app。原生拖动控件的历史回弹问题不能靠主题保证解决。

## 缩略图缓存

仅匹配插件目录内 `thumb_<资源ID>.jpg` 和 `thumb_v2_<资源ID>_<更新时间>.jpg`。按最近使用顺序保留至多 128 个、总计 32 MiB、30 天内的文件；正在生成的文件不参与清理。启动和缩略图使用后进行合并清理。

失败附件回退到无图列表；保留资源句柄释放。正文、笔记资源、其他插件和用户配置不由此清理逻辑写入或删除。

## 发布前实机清单

- 亮色和暗色：主界面、设置、搜索焦点、排序、弹窗。
- 全部笔记与单独笔记本：时间、归属、长名称。
- 紧凑与预览：待办状态、摘要、图片、滚动。
- 小窗口与宽窗口；左右拖动和松手后的位置。
- 标题前提示条；长表格、长代码、富文本和 Markdown。
- 测试后恢复原主题设置、列表模式和窗口状态。

自动测试是局部 DOM 合同验证，不能替代真实 Joplin 或外接屏测试。
