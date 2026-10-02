/* Browser regression fixtures; never attach to the user's Joplin session. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(root+'/plugin/userchrome.css','utf8');
const bodyCss=fs.readFileSync(root+'/plugin/userstyle.css','utf8');
const out=path.join(root,'validation');fs.mkdirSync(out,{recursive:true});
function fixture(width,banners,location,dark){return `<!doctype html><style>
:root{--joplin-background-color:${dark?'#202124':'#fff'};--joplin-color:${dark?'#e4e5e7':'#343a43'};--joplin-url-color:${dark?'#8ab4f8':'#2858e8'}}
*{box-sizing:border-box}body{margin:0;background:var(--joplin-background-color);color:var(--joplin-color)}
.rli-editor{position:relative;width:${width}px;height:650px}.note-title-wrapper{display:flex;padding-left:8px}.title-input{width:100%;font-size:20px;background:transparent;border:0}.note-title-info-group{display:flex}.toolbar{display:flex;width:150px;height:40px;align-items:center;gap:8px}.updated-time-label{font-size:13px}.banner{padding:8px;background:#ccc5}
${css}</style><div class="rli-editor"><div style="width:${width}px;height:100%"><div style="display:flex;flex-direction:column;height:100%">
${Array.from({length:banners},(_,i)=>`<div class="banner">状态提示 ${i+1}</div>`).join('')}
<div class="note-title-wrapper"><input class="title-input" value="这是一个很长的正文标题，用来验证小屏幕布局不会挤出边界"><div class="note-title-info-group"><span class="updated-time-label">2026/09/15 22:30</span><div class="toolbar"><button>语言</button><button>信息</button><button>更多</button></div></div></div>
${location?'<div class="location"><button><i class="icon icon-notebooks"></i><span>归属于：这是一个非常长的笔记本名称，必须保持省略而不能挤压时间和正文</span></button></div>':''}
<div class="body-area" style="display:flex;flex:1;padding-left:8px;min-height:0;max-height:100%"><div style="padding:30px 24px">正文内容区</div></div><div class="aux"></div><div class="editor-status-bar">标签栏</div><div class="search"></div>
</div></div></div>`}
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const page=await browser.newPage({viewport:{width:1500,height:800}});let count=0;
for(const dark of [false,true])for(const width of [400,540,800,1400])for(const banners of [0,1,2,3])for(const location of [false,true]){
await page.setContent(fixture(width,banners,location,dark));
const r=await page.evaluate(()=>{
const rect=s=>{let e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
return {title:rect('.title-input'),date:rect('.updated-time-label'),tools:rect('.toolbar'),location:rect('.location'),body:rect('.body-area'),status:rect('.editor-status-bar'),banners:[...document.querySelectorAll('.banner')].map(e=>e.getBoundingClientRect().bottom),scroll:document.documentElement.scrollWidth};});
const label=JSON.stringify({width,banners,location,dark});
assert(r.title.right<=r.tools.left+1,'title/tool overlap '+label);assert(r.date.top>=r.title.bottom-1,'date/title overlap '+label);
if(location){assert(r.body.top>=r.location.bottom-1,'location/body overlap '+label);assert(r.location.right<=width+1,'location overflow '+label);if(width>540)assert(Math.abs(r.location.left-r.date.right)<=1,'metadata items have an oversized gap '+label)}
assert(r.body.top>=r.date.bottom-1,'date/body overlap '+label);assert(r.body.height>200,'body collapsed '+label);assert(r.status.bottom<=651,'status overflow '+label);assert(r.tools.right<=width+1,'toolbar overflow '+label);
if(banners)assert(r.title.top>=Math.max(...r.banners)-1,'banner/title overlap '+label);
count++;
if(banners===1&&location&&[400,800].includes(width))await page.screenshot({path:path.join(out,`${dark?'dark':'light'}-${width}.png`),clip:{x:0,y:0,width,height:650}});
}
// Complex note content must scroll locally, not widen its document.
for(const width of [350,800]){
await page.setContent(`<style>${bodyCss}</style><h1>复杂正文</h1><p>${'很长的内容'.repeat(60)}</p><pre>${'long_code_without_break'.repeat(80)}</pre><table><tr>${'<td>very-long-unbreakable-cell-value</td>'.repeat(12)}</tr></table>`);await page.setViewportSize({width,height:800});
const r=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth,pre:document.querySelector('pre').scrollWidth>document.querySelector('pre').clientWidth}));assert(r.doc<=r.w+1,'document overflow');assert(r.pre,'code must scroll');count++;
}
// Table fills must remain translucent in both themes. A Joplin background
// variable can report white inside the Markdown webview even in dark mode.
for(const dark of [false,true]){
const bg=dark?'#202124':'#fff',text=dark?'#e4e5e7':'#343a43';
await page.setContent(`<style>:root{--joplin-background-color:${bg};--joplin-color:${text}}body{background:${bg};color:${text}}${bodyCss}.mce-item-table,.mce-item-table th,.mce-item-table td{border:1px dashed #bbb!important}</style><table class="mce-item-table"><thead><tr><th>项目</th><th>内容</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>`);
const colors=await page.evaluate(()=>{const s=q=>getComputedStyle(document.querySelector(q));return {table:s('table').backgroundColor,head:s('th').backgroundColor,alt:s('tbody tr:nth-child(2) td').backgroundColor,text:s('td').color,frame:s('table').borderTopColor,shadow:s('table').boxShadow,gridStyle:s('tbody tr:first-child td').borderRightStyle,lastRight:s('tbody tr:first-child td:last-child').borderRightStyle,lastBottom:s('tbody tr:last-child td').borderBottomStyle}});
assert.match(colors.table,/\/ 0\.025\)/,'table surface must use a subtle translucent theme panel');
assert.match(colors.head,/\/ 0\.08\)/,'table header must use a translucent theme overlay');
assert.match(colors.alt,/\/ 0\.04\)/,'alternate row must use a translucent theme overlay');
assert.equal(colors.frame,'rgba(0, 0, 0, 0)','the transparent layout border must not add a mismatched color');
assert.match(colors.shadow,/\/ 0\.22\)/,'table must keep a closed outer frame');
assert.equal(colors.gridStyle,'solid','rich text table guides must render as solid grid lines');
assert.equal(colors.lastRight,'none','rich text table must not double its right frame');
assert.equal(colors.lastBottom,'none','rich text table must not double its bottom frame');
assert.equal(colors.text,dark?'rgb(228, 229, 231)':'rgb(52, 58, 67)','table text must inherit the active theme');count++;
}
await page.setViewportSize({width:1000,height:700});
await page.setContent(`<style>${css}</style><div class="rli-sideBar"><div class="list-item-wrapper" data-folder-id="group" aria-expanded="true"><a class="list-item">组名称</a></div><div class="list-item-wrapper -selected" data-folder-id="selected" aria-expanded="true"><a class="list-item">选中组</a></div></div>`);
const weights=await page.locator('a').evaluateAll(els=>els.map(e=>getComputedStyle(e).fontWeight));assert.deepEqual(weights,['600','600']);count++;
// CSS parser catches silently dropped declarations introduced during restructuring.
const errors=await page.evaluate(css=>{const s=new CSSStyleSheet();s.replaceSync(css);return s.cssRules.length;},css);assert(errors>100);
// Source mode should show the literal Markdown marker without Joplin's
// rendered-looking quote rail. Preview blockquotes are covered by userstyle.
await page.setContent(`<style>${css}</style><div class="rli-editor"><div class="cm-editor"><div class="cm-line cm-blockQuote"><span class="tok-meta">&gt;</span> 引用内容</div></div></div>`);
const sourceQuote=await page.locator('.cm-blockQuote').evaluate(e=>({borderLeftWidth:getComputedStyle(e).borderLeftWidth,marker:e.querySelector('.tok-meta')?.textContent}));
assert.equal(sourceQuote.borderLeftWidth,'0px','Markdown source quote rail must be removed');
assert.equal(sourceQuote.marker,'>','Markdown source quote marker must remain visible');count++;
// Popup notifications use a quiet theme surface while preserving semantic
// status colour in the icon and border. The native ripple is intentionally hidden.
for(const dark of [false,true]){
const vars=dark
?'--joplin-background-color:#202124;--joplin-color:#e4e5e7;--joplin-url-color:#8ab4f8;--joplin-color-correct:#6fca78;--joplin-color-error:#ff7770'
:'--joplin-background-color:#fff;--joplin-color:#343a43;--joplin-url-color:#2858e8;--joplin-color-correct:#238636;--joplin-color-error:#cf222e';
await page.setContent(`<style>:root{${vars}}body{background:var(--joplin-background-color)}.popup-notification-list.-overlay{position:absolute}.popup-notification-item{position:relative;display:flex;align-items:center}${css}</style><ul class="popup-notification-list -overlay"><li class="popup-notification-item -success"><i class="icon">✓</i><div class="ripple"></div><div class="content">已成功将笔记移到回收站中。 <button class="link-button">取消</button></div></li></ul>`);
const notification=await page.locator('.popup-notification-item').evaluate(e=>{const s=getComputedStyle(e),icon=getComputedStyle(e.querySelector('.icon')),ripple=getComputedStyle(e.querySelector('.ripple')),button=getComputedStyle(e.querySelector('button'));return {background:s.backgroundColor,color:s.color,radius:s.borderRadius,height:e.getBoundingClientRect().height,iconBackground:icon.backgroundColor,ripple:ripple.display,button:button.textDecorationLine}});
assert.notEqual(notification.background,notification.iconBackground,'notification surface must be quieter than the semantic icon');
assert.equal(notification.color,dark?'rgb(228, 229, 231)':'rgb(52, 58, 67)','notification text must follow the active theme');
assert.equal(notification.radius,'10px');
assert(notification.height>=52&&notification.height<70,'notification must remain compact');
assert.equal(notification.ripple,'none');
assert.equal(notification.button,'none');count++;
await page.screenshot({path:path.join(out,`notification-${dark?'dark':'light'}.png`),clip:{x:500,y:480,width:500,height:220}});
}
await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify({passed:count,metadataScenarios:64,complexBody:2,tableThemes:2,groupWeight:1,sourceQuote:1,notificationThemes:2,scope:'Synthetic Chromium fixtures, not full Joplin integration'},null,2));console.log(`PASS ${count} layout scenarios: light/dark, 400–1400px editor, 0–3 banners, location, long content, table themes, group weight, notifications`);
})().catch(e=>{console.error(e);process.exit(1)});
