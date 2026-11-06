import test from 'node:test';
import assert from 'node:assert/strict';
import {Converter} from 'opencc-js/cn2t';
import {captureSelection,convertProse,readerView,MAX_READER_LENGTH,contextPointInSelection} from '../src/reader-core.mjs';
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
 assert.throws(()=>readerView(original,'unknown',convert),/Unknown reader mode/);
 assert.throws(()=>readerView(original,'simplified',{}),/Missing reader converter/);
});
test('protects marked code, commands, addresses and parameters',()=>{
 const tokens=['`简体变量`','https://example.test/简体','C:\\用户\\文件.txt','/tmp/简体.txt','../简体/文件.txt','\\\\server\\用户','{filename}','${model}','%s'];
 for(const token of tokens)assert.equal(convertProse('显示 '+token+' 后继续',convert),'顯示 '+token+' 後繼續');
 const code='```js\nconst 名称="简体";\n```';assert.equal(convertProse('说明\n'+code+'\n结束',convert),'說明\n'+code+'\n結束');
 assert.equal(convertProse('说明\n```js\nconst 名称="简体";',convert),'說明\n```js\nconst 名称="简体";');
 assert.equal(convertProse('说明\ngit commit -m "简体"\n结束',convert),'說明\ngit commit -m "简体"\n結束');
});
test('context actions require actual selected text under pointer or keyboard invocation',()=>{
 const sample={isCollapsed:false,rangeCount:1,getRangeAt:()=>({getClientRects:()=>[{left:10,right:30,top:20,bottom:40}]})};
 assert.equal(contextPointInSelection(sample,{clientX:15,clientY:25}),true);
 assert.equal(contextPointInSelection(sample,{clientX:50,clientY:25}),false);
 assert.equal(contextPointInSelection(sample,{clientX:0,clientY:0}),true);
 assert.equal(contextPointInSelection({...sample,isCollapsed:true},{clientX:0,clientY:0}),false);
});
// Modal/clipboard/listener lifecycle is tested with real React + Edge in browser-smoke,
// not a handcrafted hook/dialog imitation.
