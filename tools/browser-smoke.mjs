// Explicit live smoke test against an already-running LOCAL DSH. No server started.
// Uses a separate temporary Edge context, synthetic test-owned DOM, and a stubbed
// clipboard: never reads/writes the OS clipboard or sends a chat/model request.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const address=process.argv[2];
if(!address||!['127.0.0.1','localhost','[::1]'].includes(new URL(address).hostname))throw Error('Pass the existing local DSH URL explicitly.');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
let fixtureCreated=false;const page=await context.newPage();
await page.addInitScript(()=>{
 window.__readerSmoke={writes:[],mode:'ok',constructors:0};
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{
  const state=window.__readerSmoke;state.writes.push(text);
  if(state.mode==='deny')throw Error('test permission denied');
  if(state.mode==='defer')await new Promise(resolve=>{state.resolve=resolve;});
 }}});
});
try{
 await page.goto(address,{waitUntil:'domcontentloaded'});
 const launch=page.locator('.dsh-zhtw-reader-launch');await launch.waitFor({state:'visible',timeout:45000});
 await page.evaluate(()=>{
  const root=document.createElement('section');root.id='reader-smoke-fixture';root.style.cssText='position:fixed;top:80px;left:20px;z-index:9999;max-width:500px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)';
  for(const [id,tag,text]of [['reader-smoke-prose','p','用户消息与头发。路径 C:\\用户\\文件.txt'],['reader-smoke-code','code','const 用户="简体";'],['reader-smoke-edit','div','编辑区简体']]){
   const node=document.createElement(tag);node.id=id;node.textContent=text;if(id==='reader-smoke-edit')node.contentEditable='true';root.append(node);
  }
  const input=document.createElement('input');input.id='reader-smoke-input';input.value='输入框简体';root.append(input);
  customElements.define('reader-smoke-probe',class extends HTMLElement{constructor(){super();window.__readerSmoke.constructors++;}});
  const span=document.createElement('div');span.id='reader-smoke-mixed';span.append(document.createTextNode('普通内文'));
  span.append(document.createElement('reader-smoke-probe'));const code=document.createElement('code');code.textContent='简体代码';span.append(code);root.append(span);
  document.body.append(root);
 });fixtureCreated=true;
 const select=async id=>page.evaluate(id=>{const node=document.getElementById(id);const range=document.createRange();range.selectNodeContents(node);const s=window.getSelection();s.removeAllRanges();s.addRange(range);},id);
 const dialog=page.locator('.dsh-zhtw-reader-dialog');const content=page.locator('.dsh-zhtw-reader-content');
 const buttons=dialog.locator('button');
 const close=async()=>{await buttons.nth(0).click();await dialog.waitFor({state:'hidden'});};
 const source='用户消息与头发。路径 C:\\用户\\文件.txt';const translated='用戶消息與頭髮。路徑 C:\\用户\\文件.txt';
 await select('reader-smoke-prose');await launch.click();await dialog.waitFor({state:'visible'});
 assert.equal(await content.textContent(),translated);assert.equal(await page.locator('#reader-smoke-prose').textContent(),source);
 await buttons.nth(1).click();assert.equal(await content.textContent(),source);await buttons.nth(2).click();assert.equal(await content.textContent(),translated);
 await buttons.nth(3).click();assert.deepEqual(await page.evaluate(()=>window.__readerSmoke.writes),[source]);
 // Native selection observes the displayed Unicode; no global copy interception.
 await content.evaluate(node=>{const r=document.createRange();r.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(r);});
 assert.equal(await page.evaluate(()=>getSelection().toString()),translated);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await content.textContent(),'');
 assert.equal(await launch.evaluate(node=>document.activeElement===node),true);
 for(const id of ['reader-smoke-code','reader-smoke-edit','reader-smoke-mixed']){
  await select(id);await launch.click();await dialog.waitFor({state:'visible'});assert.equal(await content.textContent(),'');assert.equal(await buttons.nth(3).isDisabled(),true);await close();
 }
 assert.equal(await page.evaluate(()=>window.__readerSmoke.constructors),1,'selected DOM must never be cloned');
 await page.locator('#reader-smoke-input').focus();await page.locator('#reader-smoke-input').selectText();await launch.click();await dialog.waitFor({state:'visible'});assert.equal(await content.textContent(),'');await close();
 await page.evaluate(()=>{window.__readerSmoke.mode='defer';});await select('reader-smoke-prose');await launch.click();await dialog.waitFor({state:'visible'});await buttons.nth(3).click();await close();
 await select('reader-smoke-prose');await launch.click();await dialog.waitFor({state:'visible'});
 const noticeBefore=await dialog.locator('[role="status"]').textContent();await page.evaluate(()=>window.__readerSmoke.resolve());
 await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await dialog.locator('[role="status"]').textContent(),noticeBefore,'stale clipboard result ignored');
 await page.evaluate(()=>{window.__readerSmoke.mode='deny';});await buttons.nth(3).click();await page.waitForFunction(()=>document.querySelector('.dsh-zhtw-reader-dialog [role="status"]').textContent.includes('剪貼簿'));
 await close();await context.setOffline(true);await select('reader-smoke-prose');await launch.click();await dialog.waitFor({state:'visible'});assert.equal(await content.textContent(),translated,'converter works offline');await close();await context.setOffline(false);
 for(const colorScheme of ['dark','light']){await page.emulateMedia({colorScheme});await select('reader-smoke-prose');await launch.click();assert.equal(await content.isVisible(),true);await close();}
 await page.setViewportSize({width:390,height:760});await select('reader-smoke-prose');await launch.click();const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'dialog fits narrow viewport');await close();
 console.log('PASS: live Edge at existing DSH URL — selection, original/Traditional, original-copy stub, native displayed selection, Escape/focus/clear, code/edit/input rejection, no DOM cloning, stale/denied clipboard, offline conversion, theme media and narrow viewport. OS clipboard and visual aesthetics not asserted.');
}finally{
 if(fixtureCreated&&!page.isClosed())await page.evaluate(()=>document.getElementById('reader-smoke-fixture')?.remove()).catch(()=>{});
 await context.close();await browser.close();
}
