/* Sidebar state regression fixtures; never attach to the user's Joplin session. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(root+'/plugin/userchrome.css','utf8');

const html=`<!doctype html><style>
:root{--joplin-background-color:#fff;--joplin-color:#343a43;--joplin-url-color:#2858e8;--joplin-selected-color2:#ddd;--joplin-focus-outline-color:#222;--joplin-background-color-hover2:#999}
body{margin:0}.rli-sideBar{width:260px}.list-item-wrapper{height:30px}.list-item-wrapper > a,.list-item-wrapper > div,.sidebar-header-container{background:#555}
${css}</style>
<div class="rli-sideBar">
  <div role="tree">
    <div id="folder" tabindex="0" class="list-item-wrapper -selected-primary -highlight-on-hover" data-folder-id="f1" aria-level="2">
      <a class="list-item"><span class="title">010 - Working | 工作台</span><span class="note-count-label">1</span></a>
    </div>
    <div id="tagHeader" tabindex="0" class="list-item-wrapper -highlight-on-hover">
      <div class="sidebar-header-container"><span class="label">标签</span><a class="sidebar-expand-link">⌄</a></div>
    </div>
    <div id="tag" tabindex="0" class="list-item-wrapper -selected -highlight-on-hover">
      <a class="list-item"><span class="title">测试</span><span class="note-count-label">1</span></a>
    </div>
    <div id="trash" tabindex="0" class="list-item-wrapper -highlight-on-hover" aria-expanded="true">
      <button class="toggle">⌄</button><a class="list-item"><i class="fa-trash"></i><span class="title">回收站</span></a>
    </div>
    <div id="trashChild" tabindex="0" class="list-item-wrapper -selected -highlight-on-hover" data-folder-id="trashed-folder">
      <a class="list-item"><span class="title">已删除的笔记本</span></a>
    </div>
  </div>
</div>`;

(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const page=await browser.newPage({viewport:{width:500,height:300}});
await page.setContent(html);
const selectedBg=await page.locator('#folder').evaluate(e=>getComputedStyle(e).backgroundColor);
await page.hover('#folder');
assert.equal(await page.locator('#folder').evaluate(e=>getComputedStyle(e).backgroundColor),selectedBg,'selected primary hover must not switch to hover color');
await page.locator('#folder').focus();
assert.equal(await page.locator('#folder').evaluate(e=>getComputedStyle(e).backgroundColor),selectedBg,'selected primary focus must keep selected color');
for(const selector of ['#folder > a','#tag > a','#tagHeader > .sidebar-header-container']){
  const bg=await page.locator(selector).evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(bg,'rgba(0, 0, 0, 0)',`${selector} must not add an inner background`);
}
await page.hover('#tagHeader');
assert.notEqual(await page.locator('#tagHeader').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','tag header hover should color the row');
await page.locator('#tagHeader').focus();
assert.equal(await page.locator('#tagHeader > .sidebar-header-container').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','tag header focus must not add native inner background');
const trashBounds=await page.locator('#trash').boundingBox();
const childBounds=await page.locator('#trashChild').boundingBox();
assert(trashBounds.y+trashBounds.height<=childBounds.y,'trash heading must not overlap its selected child');
await browser.close();
console.log('PASS sidebar selection and trash hierarchy states');
})().catch(e=>{console.error(e);process.exit(1)});
