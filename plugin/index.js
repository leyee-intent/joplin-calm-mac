/* Local note previews; no remote image downloads or note mutations. */
joplin.plugins.register({
  onStart: async function () {
    await joplin.settings.registerSection('calmMac', {
      label: 'Calm Mac 外观',
      iconName: 'fas fa-palette',
      description: '切换默认外观与定制样式。保存后，完全退出 Joplin（⌘Q）再重新打开生效。明暗模式仍在“外观”中设置。'
    });
    await joplin.settings.registerSettings({
      appearance: {
        value: 'calm', type: 2, isEnum: true, public: true,
        section: 'calmMac', label: '界面样式',
        options: { calm: 'Calm Mac · 简洁样式', native: 'Joplin 默认外观' },
        description: '选择后点击“应用”或“确认”，然后完整重启。默认外观保留你的笔记、插件、明暗模式与栏宽。'
      }
    });
    const appearance = await joplin.settings.value('appearance');
    if (appearance !== 'calm') return;
    const dir = await joplin.plugins.installationDir();
    await joplin.window.loadChromeCssFile(dir + '/userchrome.css');
    await joplin.window.loadNoteCssFile(dir + '/userstyle.css');
    await pruneThumbnails();
    await registerCalmList();
    await registerCompactTasks();
  }
});

function previewText(body, title) {
  let text = String(body || '').slice(0, 16000)
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s*)?)/gm, '')
    .replace(/[*_`~]/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  if (title && text.startsWith(title)) text = text.slice(title.length).trim();
  return text.slice(0, 180);
}
// Own cache files only. Never read/write Joplin settings or note contents.
const thumbnailJobs = new Map();
const activeThumbnailFiles = new Set();
const CACHE_MAX_FILES = 128;
const CACHE_MAX_BYTES = 32 * 1024 * 1024;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_FILE = /^thumb_(?:v2_)?[a-f0-9]{32}(?:_[0-9]+)?\.jpg$/;
let cacheDirectory;
let pruning;
let pruneRequested = false;

async function getCacheDirectory() {
  if (!cacheDirectory) cacheDirectory = joplin.plugins.dataDir();
  return cacheDirectory;
}

function pruneThumbnails() {
  // Coalesce render bursts: at most one running cleanup and one requested rerun.
  pruneRequested = true;
  if (pruning) return pruning;
  pruning = (async () => {
    do {
      pruneRequested = false;
      await pruneCacheFiles();
    } while (pruneRequested);
  })().catch(error => console.warn('Calm Mac thumbnail cleanup:', error.message))
    .finally(() => { pruning = undefined; });
  return pruning;
}

async function pruneCacheFiles() {
  const fs = joplin.require('fs-extra');
  const dir = await getCacheDirectory();
  const entries = [];
  for (const name of await fs.readdir(dir)) {
    if (!CACHE_FILE.test(name) || activeThumbnailFiles.has(name)) continue;
    try {
      const info = await fs.lstat(dir + '/' + name);
      if (info.isFile()) entries.push({ name, bytes: info.size, time: info.mtimeMs });
    } catch (_) { /* A concurrent cache miss can replace an entry. */ }
  }
  entries.sort((a, b) => b.time - a.time);
  let bytes = 0, count = 0;
  for (const entry of entries) {
    if (activeThumbnailFiles.has(entry.name)) continue;
    const expired = entry.time < Date.now() - CACHE_MAX_AGE_MS;
    const obsolete = !entry.name.startsWith('thumb_v2_');
    if (expired || obsolete || count >= CACHE_MAX_FILES || bytes + entry.bytes > CACHE_MAX_BYTES) {
      try { await fs.unlink(dir + '/' + entry.name); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    } else {
      bytes += entry.bytes;
      count++;
    }
  }
}

async function thumbnail(body) {
  const ids = [...String(body || '').slice(0, 16000).matchAll(/(?:!\[[^\]]*\]\(\s*|<img\b[^>]*\bsrc=["'])\:\/([a-f0-9]{32})/gi)].map(m => m[1].toLowerCase());
  for (const id of [...new Set(ids)].slice(0, 5)) {
    try {
      const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime', 'updated_time'] });
      if (!/^image\/(png|jpeg|gif|webp|bmp)$/i.test(resource.mime || '')) continue;
      const revision = Number.isSafeInteger(resource.updated_time) && resource.updated_time >= 0 ? resource.updated_time : 0;
      const name = `thumb_v2_${id}_${revision}.jpg`;
      if (!thumbnailJobs.has(name)) {
        const job = createThumbnail(id, name);
        thumbnailJobs.set(name, job);
        // Keep only pending jobs: successful images are reused from the bounded disk cache.
        job.finally(() => { if (thumbnailJobs.get(name) === job) thumbnailJobs.delete(name); });
      }
      const result = await thumbnailJobs.get(name);
      if (result) return result;
    } catch (_) { /* Missing/unsupported attachments must not break the note list. */ }
  }
  return '';
}

async function createThumbnail(id, name) {
  let original, resized;
  activeThumbnailFiles.add(name);
  try {
    const fs = joplin.require('fs-extra');
    const path = (await getCacheDirectory()) + '/' + name;
    let cached = false;
    try { const stat = await fs.lstat(path); cached = stat.isFile() && stat.size > 0; } catch (_) {}
    if (!cached) {
      original = await joplin.imaging.createFromResource(id);
      resized = await joplin.imaging.resize(original, { width: 144 });
      await joplin.imaging.toJpgFile(resized, path, 80);
    }
    await fs.utimes(path, new Date(), new Date());
    return 'file://' + path.split('/').map(encodeURIComponent).join('/');
  } catch (_) { return ''; }
  finally {
    for (const handle of new Set([original, resized].filter(Boolean))) {
      try { await joplin.imaging.free(handle); } catch (_) {}
    }
    activeThumbnailFiles.delete(name);
    void pruneThumbnails();
  }
}

async function registerCalmList() {
  await joplin.views.noteList.registerRenderer({
    id: 'calmPreview', label: async () => 'Calm Mac · 分类预览',
    flow: 'topToBottom', itemSize: { width: 0, height: 84 },
    dependencies: ['item.selected', 'note.title', 'note.body', 'note.is_todo', 'note.todo_completed', 'note.todoStatusText'],
    itemCss: `
      > .content.calm-preview { box-sizing: border-box; height: 78px; padding: 8px 12px; display: flex; align-items: center; gap: 12px; overflow: hidden; font-weight: 400; }
      .calm-copy { flex: 1; min-width: 0; }
      .calm-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500; line-height: 22px; }
      .calm-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; line-height: 18px; margin-top: 3px; opacity: .65; font-weight: 400; }
      .calm-thumb { width: 56px; height: 56px; flex: 0 0 56px; object-fit: cover; border-radius: 6px; }
      .calm-check { width: 16px; height: 16px; flex: 0 0 16px; margin: 0; accent-color: var(--joplin-url-color); }
      .calm-done .calm-title { text-decoration: line-through; opacity: .55; }
    `,
    itemTemplate: `<div class="content calm-preview {{#item.selected}}-selected{{/item.selected}} {{#note.todo_completed}}calm-done{{/note.todo_completed}}">
      {{#note.is_todo}}<input class="calm-check" type="checkbox" data-id="todo-checkbox" aria-label="{{note.todoStatusText}}" {{#note.todo_completed}}checked{{/note.todo_completed}}>{{/note.is_todo}}
      <div class="calm-copy"><div class="calm-title">{{note.title}}</div>{{^note.is_todo}}{{#summary}}<div class="calm-summary">{{summary}}</div>{{/summary}}{{/note.is_todo}}</div>
      {{#thumb}}<img class="calm-thumb" src="{{thumb}}" alt="">{{/thumb}}
    </div>`,
    onRenderNote: async props => ({ ...props,
      summary: props.note.is_todo ? '' : previewText(props.note.body, props.note.title),
      thumb: props.note.is_todo ? '' : await thumbnail(props.note.body)
    })
  });
}

// A separate fixed-height renderer: native list geometry stays accurate.
async function registerCompactTasks() {
  await joplin.views.noteList.registerRenderer({
    id: 'calmCompactTasks', label: async () => 'Calm Mac · 紧凑待办',
    flow: 'topToBottom', itemSize: { width: 0, height: 36 },
    dependencies: ['item.selected', 'note.title', 'note.is_todo', 'note.todo_completed', 'note.todoStatusText'],
    itemCss: `
      > .content.calm-task { box-sizing: border-box; height: 32px; padding: 5px 12px; display: flex; align-items: center; gap: 9px; overflow: hidden; font-weight: 400; }
      .calm-task-check { width: 15px; height: 15px; flex: 0 0 15px; margin: 0; accent-color: var(--joplin-url-color); cursor: pointer; }
      .calm-task-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 22px; font-weight: 400; }
      .calm-task.-selected .calm-task-title { font-weight: 500; }
      .calm-task.calm-complete .calm-task-title { text-decoration: line-through; opacity: .55; }
    `,
    itemTemplate: `<div class="content calm-task {{#item.selected}}-selected{{/item.selected}} {{#note.todo_completed}}calm-complete{{/note.todo_completed}}">
      {{#note.is_todo}}<input class="calm-task-check" type="checkbox" data-id="todo-checkbox" aria-label="{{note.todoStatusText}}" {{#note.todo_completed}}checked{{/note.todo_completed}}>{{/note.is_todo}}
      <div class="calm-task-title">{{note.title}}</div>
    </div>`,
    onRenderNote: async props => props
  });
}

