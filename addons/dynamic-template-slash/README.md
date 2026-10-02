# 动态模板斜杠命令

输入斜杠命令，在 Joplin Markdown 编辑器的当前光标位置插入模板笔记的最新正文。

| 命令 | 模板 |
| --- | --- |
| `/template-2w2h` | 2W2H 知识笔记模板 |
| `/template-quote` | 产品报价记录模板 |
| `/template-task` | 任务模板 |
| `/template-project` | 项目总览模板 |

插件按笔记 ID 动态读取正文。修改原模板后，无需重新构建或配置插件。
输入 `/template` 或更短的 `/tem` 会列出全部模板；继续输入模板名称的前几个字符可以过滤候选项。

```bash
python3 scripts/build.py
node tests/plugin.cjs
```

## 首次配置

源码中的四个 noteId 均为虚构示例。请在 `plugin/index.js` 中替换成自己的模板笔记 ID，再构建安装；不要将个人配置提交到公开仓库。未配置时命令不会返回模板。
