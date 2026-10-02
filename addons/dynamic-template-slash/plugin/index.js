/* Dynamic template insertion. Reads only the configured template notes and
   returns their latest bodies to the Markdown editor on demand. */
const TEMPLATE_COMMANDS = Object.freeze([
  { command: 'template-2w2h', noteId: '11111111111111111111111111111111' },
  { command: 'template-quote', noteId: '22222222222222222222222222222222' },
  { command: 'template-task', noteId: '33333333333333333333333333333333' },
  { command: 'template-project', noteId: '44444444444444444444444444444444' }
]);

joplin.plugins.register({
  onStart: async function () {
    const scriptId = 'dynamic-template-slash-cm6';
    await joplin.contentScripts.register('codeMirrorPlugin', scriptId, './contentScript.js');
    await joplin.contentScripts.onMessage(scriptId, async message => {
      if (!message || message.type !== 'getDynamicTemplates') return null;
      return loadTemplateSuggestions(message.query);
    });
  }
});

async function loadTemplateSuggestions(query) {
  const normalized = String(query || '').replace(/^\//, '').toLowerCase();
  const mappings = TEMPLATE_COMMANDS.filter(item => item.command.startsWith(normalized));
  const notes = new Map();

  await Promise.all([...new Set(mappings.map(item => item.noteId))].map(async noteId => {
    try {
      const note = await joplin.data.get(['notes', noteId], {
        fields: ['id', 'title', 'body', 'updated_time']
      });
      if (note && typeof note.body === 'string') notes.set(noteId, note);
    } catch (error) {
      console.warn(`Dynamic template slash: unavailable template ${noteId}: ${error.message}`);
    }
  }));

  return mappings.flatMap(item => {
    const note = notes.get(item.noteId);
    if (!note) return [];
    return [{
      command: item.command,
      title: note.title,
      body: note.body,
      updatedTime: note.updated_time || 0
    }];
  });
}
