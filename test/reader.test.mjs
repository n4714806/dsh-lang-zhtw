import test from 'node:test';
import assert from 'node:assert/strict';
import {Converter} from 'opencc-js/cn2t';
import {captureSelection,convertProse,readerView,MAX_READER_LENGTH} from '../src/reader-core.mjs';
import {installReader} from '../src/reader.mjs';
const convert=Converter({from:'cn',to:'tw'});
function selection(text,{parentProtected=false,fragmentProtected=false}={}){return {isCollapsed:false,rangeCount:1,toString:()=>text,anchorNode:{nodeType:3,parentElement:{closest:()=>parentProtected?{}:null}},focusNode:{nodeType:3,parentElement:{closest:()=>null}},getRangeAt:()=>({commonAncestorContainer:{nodeType:1,matches:()=>fragmentProtected,lastChild:null},intersectsNode:()=>true,cloneContents:()=>{throw Error('DOM cloning is forbidden');}})};}
test('captures only explicit selected prose and preserves whitespace',()=>{
 assert.deepEqual(captureSelection(selection(' 简体\r\n文字 ')),{text:' 简体\r\n文字 '});
 assert.deepEqual(captureSelection(null),{error:'empty'});
 assert.deepEqual(captureSelection({...selection('x'),isCollapsed:true}),{error:'empty'});
 assert.deepEqual(captureSelection(selection(' '.repeat(4))),{error:'empty'});
});
test('rejects selection inside or across protected content',()=>{
 assert.equal(captureSelection(selection('用户',{parentProtected:true})).error,'protected');
 assert.equal(captureSelection(selection('说明与代码',{fragmentProtected:true})).error,'protected');
 assert.equal(captureSelection(selection('a'.repeat(MAX_READER_LENGTH+1))).error,'tooLong');
});
test('reader converts prose contextually without changing original',()=>{
 const original='软件发展与头发，用户消息。';assert.equal(convertProse(original,convert),'軟件發展與頭髮，用戶消息。');
 assert.equal(original,'软件发展与头发，用户消息。');assert.equal(readerView(original,'original',()=>{throw Error('must not convert');}),original);
});
test('protects marked code, commands, addresses and parameters',()=>{
 const tokens=['`简体变量`','https://example.test/简体','C:\\用户\\文件.txt','/tmp/简体.txt','../简体/文件.txt','\\\\server\\用户','{filename}','${model}','%s'];
 for(const token of tokens){assert.equal(convertProse('显示 '+token+' 后继续',convert),'顯示 '+token+' 後繼續');}
 const code='```js\nconst 名称="简体";\n```';assert.equal(convertProse('说明\n'+code+'\n结束',convert),'說明\n'+code+'\n結束');
 assert.equal(convertProse('说明\n```js\nconst 名称="简体";',convert),'說明\n```js\nconst 名称="简体";');
 assert.equal(convertProse('说明\ngit commit -m "简体"\n结束',convert),'說明\ngit commit -m "简体"\n結束');
});
function createHarness(){
 const states=[],refs=[],effects=[],dicts=new Map();let stateIndex=0,refIndex=0,component,priorDeps,cleanup,pendingEffect,tree;
 let dialogOpen=false,focused=false,disposed=0;
 const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children:children.flat()}),useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];},useRef:initial=>{const i=refIndex++;return refs[i]??=( {current:initial});},useId:()=> 'reader-title',useSyncExternalStore:()=>{},useMemo:fn=>fn(),useEffect:(fn,deps)=>{if(!priorDeps||deps.some((x,i)=>x!==priorDeps[i])){pendingEffect=fn;priorDeps=deps;}}};
 const ctx={effect:fn=>effects.push(fn()),locale:{register:(ns,tag,dict)=>{dicts.set(tag,dict);return()=>{dicts.delete(tag);disposed++;};},bind:()=>key=>dicts.get('zh-TW')[key],subscribe:()=>()=>{},getSnapshot:()=>({})},slots:{inject:(name,fn)=>{assert.equal(name,'shell.overlay');effects.push(fn());},register:(opts,c)=>{assert.equal(opts.id,'lang-zhtw-reader');component=c;return()=>disposed++;}}};
 installReader(ctx,React);
 function nodes(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...node.children.flatMap(child=>nodes(child,predicate))];}
 function render(){stateIndex=0;refIndex=0;tree=component();for(const node of nodes(tree,x=>!!x.props.ref)){if(node.type==='dialog')node.props.ref.current={get open(){return dialogOpen;},showModal(){dialogOpen=true;},close(){dialogOpen=false;node.props.onClose();}};else node.props.ref.current={focus(){focused=true;}};}
 if(pendingEffect){cleanup?.();const fn=pendingEffect;pendingEffect=null;cleanup=fn();}return tree;}
 return {render,states,button:label=>nodes(tree,n=>n.type==='button'&&n.children.includes(label))[0],content:()=>nodes(tree,n=>n.props.className==='dsh-zhtw-reader-content')[0].children[0],get dialogOpen(){return dialogOpen;},get focused(){return focused;},dispose:()=>{cleanup?.();effects.reverse().forEach(fn=>fn());assert.equal(disposed,4);}};
}
test('panel reads only on click, toggles views, copies original and clears on close',async()=>{
 const windowBefore=Object.getOwnPropertyDescriptor(globalThis,'window'),navigatorBefore=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 let reads=0;const copied=[];const original='用户消息，头发。';
 Object.defineProperty(globalThis,'window',{configurable:true,value:{getSelection:()=>{reads++;return selection(original);}}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>copied.push(text)}}});
 try{
  const h=createHarness();h.render();assert.equal(reads,0);assert.equal(h.dialogOpen,false);
  let prevented=false;h.button('繁體閱讀').props.onPointerDown({button:0,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(reads,0);
  h.button('繁體閱讀').props.onClick();h.render();assert.equal(reads,1);assert.equal(h.dialogOpen,true);assert.equal(h.content(),'用戶消息，頭髮。');
  h.button('原文').props.onClick();h.render();assert.equal(h.content(),original);
  h.button('繁體').props.onClick();h.render();await h.button('複製原文').props.onClick();assert.deepEqual(copied,[original]);
  h.button('關閉').props.onClick();h.render();assert.equal(h.dialogOpen,false);assert.equal(h.states[0],null);assert.equal(h.content(),'');assert.equal(h.focused,true);h.dispose();
 }finally{if(windowBefore)Object.defineProperty(globalThis,'window',windowBefore);else delete globalThis.window;if(navigatorBefore)Object.defineProperty(globalThis,'navigator',navigatorBefore);else delete globalThis.navigator;}
});
