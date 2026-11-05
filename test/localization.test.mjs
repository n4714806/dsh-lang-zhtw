import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildDictionaries,renderClient,validate} from '../tools/build-plugin.mjs';
import {extractDictionary} from '../tools/static-dictionary.mjs';
import {convertText,protectedTokens} from '../tools/convert.mjs';
const root=new URL('../',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const dictionaries=buildDictionaries();

test('preserves all 63 upstream Host namespaces without rewriting',()=>{
 const host=json('dictionaries/host.zh-TW.json');assert.equal(Object.keys(host).length,63);
 for(const [namespace,dict]of Object.entries(host))assert.deepEqual(dictionaries[namespace],dict);
 assert.equal(Object.keys(dictionaries).length,65);
});
test('covers every snapshotted Mnemon/Context key and preserves exact placeholders',()=>{
 for(const source of json('dictionaries/sources.json')){
  const original=json('dictionaries/source/'+source.package+'.zh.json');
  validate(original,dictionaries[source.namespace]);
  assert.equal(Object.keys(dictionaries[source.namespace]).length,source.keys);
 }
 assert.equal(Object.keys(dictionaries.mnemon).length,1409);
 assert.equal(Object.keys(dictionaries['dsh-context']).length,737);
});
test('visible screenshot labels are translated',()=>{
 assert.equal(dictionaries.mnemon['tab.label'],'記憶系統');
 assert.equal(dictionaries.mnemon['header.backToConversation'],'返回對話');
 assert.equal(dictionaries['dsh-context']['tab.fleet'],'編隊');
 assert.equal(dictionaries['dsh-context']['cat.system'],'系統提示詞');
});
test('literal code, URLs, Windows paths and parameters survive build conversion',()=>{
 const text='读取 {path}：`用户消息`；```js\nconst 名称="简体";\n``` https://example.test/简体 C:\\用户\\文件 ${model} %s';
 assert.deepEqual(protectedTokens(convertText(text)),protectedTokens(text));
 assert.ok(convertText(text).startsWith('讀取 {path}'));
});
test('static extraction supports spread data but never executes plugin expressions',()=>{
 assert.deepEqual(extractDictionary('const base={"x":"简体"}; const zh={...base,"label":`会话`};','zh','label'),{x:'简体',label:'会话'});
 assert.throws(()=>extractDictionary('const zh={"label":process.exit()};','zh','label'),/Non-static/);
 assert.throws(()=>extractDictionary('const zh={get label(){return "x"}};','zh','label'),/Non-data/);
 assert.throws(()=>extractDictionary('const zh={"__proto__":{},"label":"x"};','zh','label'),/Unsafe/);
 assert.throws(()=>extractDictionary('const zh={"label":`${evil()}`};','zh','label'),/Non-static/);
});
test('generated artifact is reproducible and parsed data equals build inputs',()=>{
 const artifact=readFileSync(new URL('client.js',root),'utf8');
 assert.equal(artifact,renderClient(dictionaries));
 assert.deepEqual(extractDictionary(artifact,'DICTIONARIES','conversation'),dictionaries);
});
function mount(order){
 let captured;const script=renderClient(dictionaries);
 // No document/window DOM, fetch, fs, mutation observers or Host service available.
 vm.runInNewContext(script,{window:{__ModuleLoader__:{load:m=>{captured=m;}}}},{timeout:1000});
 const rows=new Map(),effects=[];let active='zh-TW';const languages=new Set(['en','zh']);
 const register=(ns,tag,dict)=>{const id=ns+'|'+tag;assert.ok(!rows.has(id),'duplicate namespace/locale '+id);rows.set(id,dict);return()=>rows.delete(id);};
 const native=()=>{for(const source of json('dictionaries/sources.json')) {register(source.namespace,'zh',json('dictionaries/source/'+source.package+'.zh.json'));register(source.namespace,'en',{probe:'English'});}};
 if(order==='before')native();
 captured.factory().apply({effect:fn=>effects.push(fn()),locale:{addLanguage:({id,fallback})=>{assert.ok(languages.has(fallback));assert.ok(!languages.has(id));languages.add(id);return()=>languages.delete(id);},register}});
 if(order==='after')native();
 const t=(ns,key,params={})=>{const value=rows.get(ns+'|'+active)?.[key]??rows.get(ns+'|zh')?.[key]??rows.get(ns+'|en')?.[key]??key;return value.replace(/\{([\w.]+)\}/g,(raw,k)=>Object.hasOwn(params,k)?params[k]:raw);};
 return {t,rows,effects,languages,setLocale:tag=>{active=tag;}};
}
for(const order of ['before','after'])test('registers before/after plugins, preserves dynamic content and disposes: '+order,()=>{
 const m=mount(order);
 assert.equal(m.t('mnemon','tab.label'),'記憶系統');
 const privateContent='简体历史 C:\\用户\\记录 gpt-6-astra';
 assert.equal(m.t('mnemon','common.showing',{visible:privateContent,total:'2'}).includes(privateContent),true);
 m.setLocale('zh');assert.equal(m.t('mnemon','tab.label'),'记忆系统');
 m.setLocale('en');assert.equal(m.t('mnemon','probe'),'English');
 for(const dispose of m.effects.reverse())dispose();
 assert.equal(m.languages.has('zh-TW'),false);
 assert.ok([...m.rows.keys()].every(key=>!key.endsWith('|zh-TW')));
 assert.equal(m.rows.get('mnemon|zh')['tab.label'],'记忆系统');
});
test('missing plugin, unknown keys and future keys retain safe fallbacks',()=>{
 const absent=mount('none');assert.equal(absent.rows.has('mnemon|zh'),false);assert.equal(absent.t('mnemon','tab.label'),'記憶系統');
 const m=mount('after');assert.equal(m.t('mnemon','unknown-key'),'unknown-key');
 m.rows.get('mnemon|zh')['future-key']='新版简体';assert.equal(m.t('mnemon','future-key'),'新版简体');
});
