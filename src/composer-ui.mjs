import {getComposerBridge,connectComposerConversion} from './composer-conversion.mjs';
import {createReaderConverters} from './reader-converters.mjs';
const words={
 'zh-TW':{uncertain:'編輯器發生異常，轉換及復原狀態無法確認。請先檢查草稿，不要重複操作。',traditional:'已轉為繁體，可按 Ctrl＋Z 復原。',simplified:'已轉為簡體，可按 Ctrl＋Z 復原。',unchanged:'文字已是目標字體，草稿未更動。',refused:'草稿、選取範圍或編輯狀態已變更，請重新按右鍵；這次未轉換。',unsupported:'目前輸入框缺少原子轉換介面，尚未啟用繁簡右鍵轉換。'},
 zh:{uncertain:'编辑器发生异常，转换与撤销状态无法确认。请先检查草稿，不要重复操作。',traditional:'已转为繁体，可按 Ctrl＋Z 撤销。',simplified:'已转为简体，可按 Ctrl＋Z 撤销。',unchanged:'文字已是目标字形，草稿未更改。',refused:'草稿、选取范围或编辑状态已变化，请重新右键；本次未转换。',unsupported:'当前输入框缺少原子转换接口，尚未启用繁简右键转换。'},
 en:{uncertain:'Editor failure: conversion and undo status are uncertain. Inspect the draft before retrying.',traditional:'Converted to Traditional. Use Undo to restore.',simplified:'Converted to Simplified. Use Undo to restore.',unchanged:'Already in the target form; draft unchanged.',refused:'Draft, selection or editing state changed. Right-click again; no conversion applied.',unsupported:'This composer lacks the atomic conversion API; native conversion is unavailable.'},
};
export function installComposerConverter(ctx,React){
 const bridge=getComposerBridge();if(!bridge)return;
 const ns='lang-zhtw-composer',h=React.createElement,converters=createReaderConverters();
 for(const [language,dict]of Object.entries(words))ctx.effect(()=>ctx.locale.register(ns,language,dict));
 const t=ctx.locale.bind(ns);
 function ComposerConverter(props){
  React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
  const anchor=React.useRef(null),current=React.useRef(props);
  React.useLayoutEffect(()=>{current.current=props;},[props.inputActions,props.sessionId]);
  const [notice,setNotice]=React.useState('');
  const supported=typeof props.inputActions?.transformDraftText==='function';
  React.useEffect(()=>{
   if(!supported)return;
   const connection=connectComposerConversion({bridge,document,window,
    getContext:()=>({root:anchor.current?.closest('[data-composer-card]')?.querySelector('[data-composer-input]'),actions:current.current.inputActions,sessionId:current.current.sessionId}),
    convert:(mode,text)=>converters[mode](text),report:setNotice});
   return()=>connection.dispose();
  },[props.inputActions,props.sessionId,supported]);
  React.useEffect(()=>{if(!notice||notice==='uncertain')return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  const label=supported?notice:'unsupported';
  return h('span',{ref:anchor,'data-composer-conversion-status':true,role:'status',style:{position:'absolute',right:12,top:-26,pointerEvents:'none',maxWidth:'90%',fontSize:12,padding:label?'4px 8px':0,borderRadius:6,color:'var(--dsw-alias-label-primary)',background:'var(--dsw-alias-bg-layer-1)'}},label?t(label):'');
 }
 ctx.slots.inject('conversation.input.overlay',()=>ctx.slots.register({name:'conversation.input.overlay',id:'lang-zhtw-composer-converter',order:40},ComposerConverter));
}
