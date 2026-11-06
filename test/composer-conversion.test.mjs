import test from 'node:test';import assert from 'node:assert/strict';import {getComposerBridge,connectComposerConversion} from '../src/composer-conversion.mjs';
function fixture(){
 const listeners=new Map(),reports=[],calls=[];let listener,clock=0,timerCallback,offs=0;const span={start:0,end:2,draftRev:1};
 const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);}};
 const root={isConnected:true,ownerDocument:document,isContentEditable:true,composing:false,hasAttribute:()=>root.composing,contains:node=>node===root};
 const actions={captureInsertion:()=>({...span}),transformDraftText:(fn,captured)=>{calls.push({captured,result:fn('用户')});return true;}};
 const context={root,actions,sessionId:'session-a'};
 const bridge={subscribe:fn=>{listener=fn;return()=>offs++;}};
 const connection=connectComposerConversion({bridge,document,window:{setTimeout:fn=>{timerCallback=fn;return 1;},clearTimeout(){}},getContext:()=>context,convert:(_mode,text)=>text.replace('用户','用戶'),report:x=>reports.push(x),now:()=>clock});
 const menu=(id=1)=>{listeners.get('contextmenu')({target:root,isTrusted:true,defaultPrevented:false});listener({kind:'open',menuId:id});};
 return {connection,document,root,context,span,reports,calls,listeners,menu,advance:ms=>clock+=ms,expire:()=>timerCallback(),message:packet=>listener(packet),act:(id=1)=>listener({kind:'action',menuId:id,mode:'traditional'}),offs:()=>offs};
}
test('composer bridge is opt-in versioned capability',()=>{assert.equal(getComposerBridge({}),null);assert.equal(getComposerBridge({dshDesktop:{composerConversion:{version:2,subscribe(){}}}}),null);const bridge={version:1,subscribe(){}};assert.equal(getComposerBridge({dshDesktop:{composerConversion:bridge}}),bridge);});
test('one native action uses exact owner span once, never submit or DOM writing',()=>{const f=fixture();assert.equal(f.calls.length,0);f.menu();f.act();f.act();assert.deepEqual(f.calls,[{captured:{start:0,end:2,draftRev:1},result:'用戶'}]);assert.deepEqual(f.reports,['traditional']);f.connection.dispose();assert.equal(f.listeners.size,0);f.connection.dispose();assert.equal(f.offs(),1);});
test('collapsed selection is delegated intact to owner whole-document semantics',()=>{const f=fixture();f.span.start=2;f.span.end=2;f.menu();f.act();assert.equal(f.calls[0].captured.start,f.calls[0].captured.end);f.connection.dispose();});
test('settled collapsed caret retains whole-draft intent but newly selected text rejects',()=>{for(const end of [10,11]){const f=fixture();f.span.start=0;f.span.end=0;f.menu();f.span.start=10;f.span.end=end;f.act();assert.equal(f.calls.length,end===10?1:0);f.connection.dispose();}});
test('native close, other token, synthetic event and outside editor cannot mutate',()=>{
 const f=fixture();f.menu();f.act(2);assert.equal(f.calls.length,0);f.message({kind:'close',menuId:1});f.act();assert.equal(f.calls.length,0);
 for(const event of [{target:{},isTrusted:true},{target:f.root,isTrusted:false},{target:f.root,isTrusted:true,defaultPrevented:true}]){f.listeners.get('contextmenu')(event);f.message({kind:'open',menuId:3});f.act(3);assert.equal(f.calls.length,0);}f.connection.dispose();
});
test('expiration is enforced without timer; revision, caret, session, IME and readonly changes reject',()=>{
 for(const mutate of [f=>f.advance(30000),f=>f.span.draftRev++,f=>f.span.start++,f=>f.context.sessionId='other',f=>f.root.composing=true,f=>f.root.isContentEditable=false,f=>f.root.isConnected=false]){const f=fixture();f.menu();mutate(f);f.act();assert.equal(f.calls.length,0);assert.deepEqual(f.reports,['refused']);f.connection.dispose();}
});
test('interaction cancellation, hidden page and timer cleanup cannot leave an actionable snapshot',()=>{
 for(const cancel of [f=>f.listeners.get('pointerdown')(),f=>f.listeners.get('keydown')(),f=>f.listeners.get('scroll')(),f=>f.listeners.get('compositionstart')(),f=>{f.document.hidden=true;f.listeners.get('visibilitychange')();},f=>f.expire()]){const f=fixture();f.menu();cancel(f);f.act();assert.equal(f.calls.length,0);f.connection.dispose();}
});
test('uncertain owner result never claims no conversion and never retries',()=>{const f=fixture();let attempts=0;f.context.actions.transformDraftText=()=>{attempts++;return null;};f.menu();f.act();f.act();assert.deepEqual(f.reports,['uncertain']);assert.equal(attempts,1);f.connection.dispose();});
test('owner refusals report no success; identity output avoids misleading undo notice',()=>{
 const f=fixture();f.context.actions.transformDraftText=()=>false;f.menu();f.act();assert.deepEqual(f.reports,['refused']);f.connection.dispose();
 const g=fixture();g.context.actions.transformDraftText=fn=>{fn('already');return true;};g.menu();g.act();assert.deepEqual(g.reports,['unchanged']);g.connection.dispose();
});
