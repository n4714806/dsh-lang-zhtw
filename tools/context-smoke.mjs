import assert from 'node:assert/strict';
// Browser fixture coverage, not proof of Electron native-menu integration.
export async function verifyContextActions(page,{select,source,translated,dialog,content,launch,close}){
 const pageBar=page.locator('.dsh-zhtw-reader-page-actions'),panelBar=page.locator('.dsh-zhtw-reader-panel-actions');
 const contextEvent=async(selector,extra={})=>page.locator(selector).evaluate((node,extra)=>{
  const rect=getSelection().rangeCount?getSelection().getRangeAt(0).getClientRects()[0]:null;
  const before=document.activeElement;
  const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect?rect.left+1:0,clientY:rect?rect.top+1:0,...extra});
  const uncancelled=node.dispatchEvent(event);
  return {uncancelled,focusPreserved:document.activeElement===before};
 },extra);
 await select('reader-smoke-prose');
 assert.deepEqual(await contextEvent('#reader-smoke-prose'),{uncancelled:true,focusPreserved:true});
 await pageBar.waitFor({state:'visible'});
 await pageBar.locator('[data-reader-action="readTraditional"]').click();await dialog.waitFor({state:'visible'});
 assert.equal(await content.textContent(),translated);assert.equal(await pageBar.count(),0);
 assert.deepEqual(await contextEvent('.dsh-zhtw-reader-content'),{uncancelled:true,focusPreserved:true});await panelBar.waitFor({state:'visible'});
 await panelBar.locator('[data-reader-action="simplified"]').click();assert.equal(await content.textContent(),source);assert.equal(await panelBar.count(),0);
 await contextEvent('.dsh-zhtw-reader-content');await panelBar.waitFor({state:'visible'});
 await panelBar.locator('[data-reader-action="original"]').focus();await page.keyboard.press('ArrowRight');
 assert.equal(await panelBar.locator('[data-reader-action="traditional"]').evaluate(node=>document.activeElement===node),true);
 await page.keyboard.press('Enter');assert.equal(await content.textContent(),translated);assert.equal(await content.evaluate(node=>document.activeElement===node),true);
 await contextEvent('.dsh-zhtw-reader-content');await panelBar.waitFor({state:'visible'});await page.keyboard.press('Escape');
 assert.equal(await panelBar.count(),0);assert.equal(await dialog.isVisible(),true);await close();
 // Convert a TW original to CN, then switch original without a lossy round-trip.
 await page.locator('#reader-smoke-prose').evaluate((node,text)=>{node.textContent=text;},translated);
 await select('reader-smoke-prose');await contextEvent('#reader-smoke-prose');await pageBar.waitFor({state:'visible'});
 await pageBar.locator('[data-reader-action="readSimplified"]').click();await dialog.waitFor({state:'visible'});assert.equal(await content.textContent(),source);
 await dialog.locator('[data-reader-action="original"]').click();assert.equal(await content.textContent(),translated);await close();
 await page.locator('#reader-smoke-prose').evaluate((node,text)=>{node.textContent=text;},source);
 // Shift bypass and events already owned by another handler must remain untouched.
 await select('reader-smoke-prose');assert.equal((await contextEvent('#reader-smoke-prose',{shiftKey:true})).uncancelled,true);assert.equal(await pageBar.count(),0);
 await page.locator('#reader-smoke-prose').evaluate(node=>node.addEventListener('contextmenu',event=>event.preventDefault(),{once:true}));
 assert.equal((await contextEvent('#reader-smoke-prose')).uncancelled,false);assert.equal(await pageBar.count(),0);
 assert.equal((await contextEvent('#reader-smoke-prose',{clientX:1200,clientY:700})).uncancelled,true);assert.equal(await pageBar.count(),0);
 for(const id of ['reader-smoke-code','reader-smoke-edit','reader-smoke-mixed']){
  await select(id);assert.equal((await contextEvent('#'+id)).uncancelled,true);assert.equal(await pageBar.count(),0);
 }
 // Programmatic selection of contenteditable focuses it; leave that editor as
 // a real click/drag into prose would before testing another prose selection.
 await launch.focus();
 await select('reader-smoke-prose');await contextEvent('#reader-smoke-prose');await pageBar.waitFor({state:'visible'});
 await pageBar.locator('[data-reader-action="readTraditional"]').focus();await page.keyboard.press('End');
 assert.equal(await pageBar.locator('[data-reader-action="dismiss"]').evaluate(node=>document.activeElement===node),true);
 await page.keyboard.press('Escape');assert.equal(await pageBar.count(),0);assert.equal(await launch.evaluate(node=>document.activeElement===node),true);
 await select('reader-smoke-prose');await contextEvent('#reader-smoke-prose');await pageBar.waitFor({state:'visible'});
 await page.locator('#reader-smoke-prose').click();assert.equal(await pageBar.count(),0);
 await select('reader-smoke-prose');await contextEvent('#reader-smoke-prose');await pageBar.waitFor({state:'visible'});
 await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await pageBar.waitFor({state:'detached'});
 // Pending actions must not reuse changed selection/content or detached nodes.
 for(const mutation of ['selection','replacement','detached']){
  await launch.focus();await select('reader-smoke-prose');await contextEvent('#reader-smoke-prose');await pageBar.waitFor({state:'visible'});
  await page.evaluate(mutation=>{
   const node=document.getElementById('reader-smoke-prose');
   if(mutation==='selection'){const range=document.createRange();range.setStart(node.firstChild,1);range.setEnd(node.firstChild,3);getSelection().removeAllRanges();getSelection().addRange(range);}
   else if(mutation==='replacement')node.textContent='替代文字';
   else{const replacement=document.createElement('p');replacement.id=node.id;replacement.textContent=node.textContent;node.replaceWith(replacement);}
  },mutation);
  await pageBar.locator('[data-reader-action="readTraditional"]').click();await dialog.waitFor({state:'visible'});assert.equal(await content.textContent(),'');await close();
  await page.locator('#reader-smoke-prose').evaluate((node,text)=>{node.textContent=text;},source);
 }
 assert.equal(await page.locator('#reader-smoke-prose').textContent(),source);
 console.log('PASS: two context action strips, CN/TW/original, non-cancelling events, no focus theft, Shift/handled/protected/stale-selection bypass, keyboard and dismissal. Native Electron menu still needs manual verification.');
}
