const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calm-cache-test-'));
let conversions=0,revision=1,fail=false,freed=[],start,appearance='calm';
const renderers=[];
const api={
 plugins:{register(x){start=x.onStart},installationDir:async()=>root+'/plugin',dataDir:async()=>dir},
 settings:{registerSection:async()=>{},registerSettings:async()=>{},value:async()=>appearance},
 window:{loadChromeCssFile:async()=>{},loadNoteCssFile:async()=>{}},
 require(name){assert.equal(name,'fs-extra');return fs.promises},
 views:{noteList:{registerRenderer:async r=>renderers.push(r)}},
 data:{get:async()=>({mime:'image/png',updated_time:revision})},
 imaging:{createFromResource:async()=>{if(fail)throw Error('missing');return 'original'},resize:async()=> 'resized',toJpgFile:async(_h,p)=>{conversions++;await fs.promises.writeFile(p,'JPEG fixture')},free:async h=>freed.push(h)}
};
const c=vm.createContext({joplin:api,console,encodeURIComponent});vm.runInContext(fs.readFileSync(root+'/plugin/index.js','utf8'),c);
(async()=>{
 await start();assert.equal(renderers.length,2);
 const renderer=renderers[0],body='# Title\nSome **summary** ![pic](:/0123456789abcdef0123456789abcdef)';
 let r=await renderer.onRenderNote({note:{is_todo:1,body,title:'Title'}});assert.equal(r.summary,'');assert.equal(r.thumb,'');assert.equal(conversions,0);
 const props={note:{is_todo:0,body,title:'Title'}};
 const results=await Promise.all(Array.from({length:8},()=>renderer.onRenderNote(props)));
 assert.equal(conversions,1);assert.equal(results[0].summary,'Some summary');assert(results.every(r=>r.thumb===results[0].thumb));assert.deepEqual(freed,['original','resized']);
 await renderer.onRenderNote(props);assert.equal(conversions,1,'persistent cache reused');
 revision=2;await renderer.onRenderNote(props);assert.equal(conversions,2,'resource revision invalidates');
 revision=3;fail=true;r=await renderer.onRenderNote(props);assert.equal(r.thumb,'');fail=false;
 for(let i=0;i<140;i++)fs.writeFileSync(path.join(dir,`thumb_v2_${i.toString(16).padStart(32,'0')}_0.jpg`),'cache');
 fs.writeFileSync(path.join(dir,'keep.txt'),'not ours');await c.pruneThumbnails();
 assert(fs.readdirSync(dir).filter(n=>n.endsWith('.jpg')).length<=128);assert.equal(fs.readFileSync(path.join(dir,'keep.txt'),'utf8'),'not ours');
 const old=path.join(dir,'thumb_v2_ffffffffffffffffffffffffffffffff_0.jpg');fs.writeFileSync(old,'old');fs.utimesSync(old,new Date(0),new Date(0));await c.pruneThumbnails();assert(!fs.existsSync(old));
 const large=path.join(dir,'thumb_v2_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee_0.jpg');fs.writeFileSync(large,Buffer.alloc(33*1024*1024));await c.pruneThumbnails();assert(!fs.existsSync(large));
 appearance='native';renderers.length=0;await start();assert.equal(renderers.length,0);
 // The settings shim deliberately has no profileDir/globalValue/onChange API:
 // startup proves it needs neither configuration-file access nor a watcher.
 assert(!fs.readFileSync(root+'/plugin/index.js','utf8').includes('settings.json'));
 console.log('PASS startup/native mode; todo; concurrent deduplication; persistent/revision cache; error fallback; handles; count/age/bytes limits; foreign files; no settings writer');
 await c.pruneThumbnails();fs.rmSync(dir,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1});
