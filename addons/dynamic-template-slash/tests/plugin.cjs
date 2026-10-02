const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const templateBodies = new Map([
  ['11111111111111111111111111111111', 'first body'],
  ['22222222222222222222222222222222', 'quote body'],
  ['33333333333333333333333333333333', 'task body'],
  ['44444444444444444444444444444444', 'project body']
]);
let messageHandler;
let registeredScript;
const joplin = {
  plugins: { register: async registration => registration.onStart() },
  contentScripts: {
    register: async (type, id, file) => { registeredScript = { type, id, file }; },
    onMessage: async (id, handler) => { assert.equal(id, registeredScript.id); messageHandler = handler; }
  },
  data: {
    get: async ([kind, id]) => {
      assert.equal(kind, 'notes');
      if (!templateBodies.has(id)) throw new Error('missing');
      return { id, title: `title-${id.slice(0, 4)}`, body: templateBodies.get(id), updated_time: 1 };
    }
  }
};

(async () => {
  vm.runInNewContext(fs.readFileSync(root + '/plugin/index.js', 'utf8'), { joplin, console });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(registeredScript, { type: 'codeMirrorPlugin', id: 'dynamic-template-slash-cm6', file: './contentScript.js' });

  const allTemplates = await messageHandler({ type: 'getDynamicTemplates', query: 'tem' });
  assert.equal(allTemplates.length, 4, 'prefix query must list all templates');

  const first = await messageHandler({ type: 'getDynamicTemplates', query: 'template-2' });
  assert.equal(first.length, 1);
  assert.equal(first[0].command, 'template-2w2h');
  assert.equal(first[0].body, 'first body');

  templateBodies.set('11111111111111111111111111111111', 'updated body');
  const refreshed = await messageHandler({ type: 'getDynamicTemplates', query: 'template-2w2h' });
  assert.equal(refreshed[0].body, 'updated body', 'template body must be fetched on every request');

  const obsoleteCommand = await messageHandler({ type: 'getDynamicTemplates', query: '2w2h' });
  assert.equal(obsoleteCommand.length, 0, 'unprefixed commands must not remain registered');

  const commandCases = [
    ['template-q', 'template-quote', 'quote body'],
    ['template-t', 'template-task', 'task body'],
    ['template-p', 'template-project', 'project body']
  ];
  for (const [query, expectedCommand, expectedBody] of commandCases) {
    const matches = await messageHandler({ type: 'getDynamicTemplates', query });
    assert.equal(matches.length, 1);
    assert.equal(matches[0].command, expectedCommand);
    assert.equal(matches[0].body, expectedBody);
  }

  let source;
  const moduleObject = { exports: {} };
  vm.runInNewContext(fs.readFileSync(root + '/plugin/contentScript.js', 'utf8'), {
    exports: moduleObject.exports,
    module: moduleObject
  });
  const extension = moduleObject.exports.default({
    postMessage: async () => [{ command: 'template-2w2h', title: '2W2H', body: '# latest' }]
  });
  await extension.plugin({
    cm6: true,
    addExtension: value => { assert.equal(value.length, 1); },
    joplinExtensions: { completionSource: fn => { source = fn; return fn; } }
  });
  const result = await source({ matchBefore: () => ({ from: 7, text: '/template-2' }) });
  assert.equal(result.from, 7);
  assert.notEqual(result.filter, false, 'CodeMirror must filter the visible options as the prefix grows');
  assert.equal(result.options[0].label, '/template-2w2h');
  assert.equal(result.options[0].apply, '# latest');
  assert.ok(!result.options[0].label.includes('# latest'), 'menu label must not expose the template body');
  console.log('PASS dynamic refresh, prefix filtering, compact labels, obsolete-command removal');
})().catch(error => { console.error(error); process.exit(1); });
