/* CodeMirror 6 completion source. The completion label stays compact while
   the applied text is the latest Markdown body returned by the main plugin. */
exports.default = context => ({
  plugin: async codeMirrorWrapper => {
    if (!codeMirrorWrapper.cm6) return;

    codeMirrorWrapper.addExtension([
      codeMirrorWrapper.joplinExtensions.completionSource(async completionContext => {
        const match = completionContext.matchBefore(/\/[A-Za-z0-9_-]*/);
        if (!match) return null;

        const suggestions = await context.postMessage({
          type: 'getDynamicTemplates',
          query: match.text.slice(1)
        });
        if (!Array.isArray(suggestions) || !suggestions.length) return null;

        return {
          from: match.from,
          validFor: /^\/[A-Za-z0-9_-]*$/,
          options: suggestions.map(template => ({
            label: `/${template.command}`,
            type: 'text',
            detail: `插入最新模板 · ${template.title}`,
            apply: template.body
          }))
        };
      })
    ]);
  }
});
