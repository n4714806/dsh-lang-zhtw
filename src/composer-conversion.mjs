// Mutations go only through the composer's versioned owner action. Never rewrite DOM.
export function getComposerBridge(scope=globalThis){const bridge=scope.dshDesktop?.composerConversion;return bridge?.version===1&&typeof bridge.subscribe==='function'?bridge:null;}
export function connectComposerConversion({bridge,document,window,getContext,convert,report,now=()=>window.performance.now()}){
 let pending=null,timer=null,disposed=false;
 const clear=()=>{pending=null;if(timer!==null){window.clearTimeout(timer);timer=null;}};
 const eligible=context=>context?.root?.isConnected&&context.root.ownerDocument===document&&context.root.isContentEditable&&!context.root.hasAttribute('data-composer-composing')&&typeof context.actions?.captureInsertion==='function'&&typeof context.actions?.transformDraftText==='function';
 const validSpan=span=>span&&Number.isSafeInteger(span.start)&&Number.isSafeInteger(span.end)&&span.start>=0&&span.end>=span.start&&Number.isSafeInteger(span.draftRev)&&span.draftRev>=0;
 const onContext=event=>{
  clear();if(event.defaultPrevented||event.isTrusted!==true)return;
  try{
   const context=getContext();if(!eligible(context)||!context.root.contains(event.target))return;
   const span=context.actions.captureInsertion();if(!validSpan(span))return;
   pending={root:context.root,actions:context.actions,sessionId:context.sessionId,span:{...span},expiresAt:now()+30000,menuId:null};
   timer=window.setTimeout(clear,30000);
  }catch{clear();}
 };
 const onNative=packet=>{
  if(disposed||!packet||!Number.isSafeInteger(packet.menuId)||packet.menuId<1)return;
  if(packet.kind==='open'){
   if(pending&&pending.menuId===null&&now()<pending.expiresAt)pending.menuId=packet.menuId;
   return;
  }
  if(!pending||packet.menuId!==pending.menuId)return;
  if(packet.kind==='close'){clear();return;}
  if(packet.kind!=='action'||!['traditional','simplified'].includes(packet.mode))return;
  const saved=pending;clear();
  try{
   const current=getContext();if(now()>=saved.expiresAt||!eligible(current)||current.root!==saved.root||current.actions!==saved.actions||current.sessionId!==saved.sessionId)throw Error('Stale composer');
   const span=current.actions.captureInsertion();
   // Right-click can settle a collapsed caret after contextmenu. Both collapsed
   // spans mean the same whole-draft scope; nonempty selections must match exactly.
   const whole=validSpan(span)&&span.start===span.end&&saved.span.start===saved.span.end;
   if(!validSpan(span)||span.draftRev!==saved.span.draftRev||(!whole&&(span.start!==saved.span.start||span.end!==saved.span.end)))throw Error('Changed draft or selection');
   let changed=false;
   const applied=current.actions.transformDraftText(text=>{const result=convert(packet.mode,text);changed ||= result!==text;return result;},saved.span);
   if(applied===null){if(!disposed)report('uncertain');return;}
   if(applied!==true)throw Error('Composer rejected transformation');
   if(!disposed)report(changed?packet.mode:'unchanged');
  }catch{if(!disposed)report('refused');}
 };
 const onVisibility=()=>{if(document.hidden)clear();};
 const events=[['contextmenu',onContext,false],['pointerdown',clear,true],['keydown',clear,true],['scroll',clear,true],['compositionstart',clear,true],['visibilitychange',onVisibility,false]];
 for(const [name,listener,capture]of events)document.addEventListener(name,listener,capture);
 let off;
 try{off=bridge.subscribe(onNative);}catch(error){for(const [name,listener,capture]of events)document.removeEventListener(name,listener,capture);clear();throw error;}
 return {clear,dispose(){if(disposed)return;disposed=true;clear();off();for(const [name,listener,capture]of events)document.removeEventListener(name,listener,capture);}};
}
