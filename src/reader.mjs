import {Converter} from 'opencc-js/cn2t';
import {captureSelection,readerView,PROTECTED_SELECTION} from './reader-core.mjs';

const words={
 'zh-TW':{open:'繁體閱讀',title:'繁體閱讀面板',hint:'先在原頁反白一般文字，再按「繁體閱讀」。不會修改原頁或資料。',privacy:'只在本頁記憶體處理；關閉即清除。面板選取複製的是顯示文字；「複製原文」保留原文。',original:'原文',traditional:'繁體',copy:'複製原文',copied:'已複製原文',copyFailed:'無法使用剪貼簿，請切換原文後手動複製。',close:'關閉',empty:'尚未選取文字。請關閉面板，在原頁反白後再開啟。',tooLong:'選取內容超過 20,000 字元，請縮小範圍。',tooComplex:'選取範圍結構太複雜，請縮小範圍。',protected:'選取包含程式碼、連結或編輯區；請只選一般內文。',readError:'無法讀取選取內容，未轉換任何資料。',convertError:'轉換失敗，以下保留原文。'},
 zh:{open:'繁体阅读',title:'繁体阅读面板',hint:'先在原页面选中普通文字，再按“繁体阅读”。不会修改原页面或数据。',privacy:'仅在本页面内存处理；关闭即清除。面板选取复制的是显示文字；“复制原文”保留原文。',original:'原文',traditional:'繁体',copy:'复制原文',copied:'已复制原文',copyFailed:'无法使用剪贴板，请切换原文后手动复制。',close:'关闭',empty:'尚未选取文字。请关闭面板，在原页面选中后再打开。',tooLong:'选取内容超过 20,000 字符，请缩小范围。',tooComplex:'选取范围结构过于复杂，请缩小范围。',protected:'选取包含代码、链接或编辑区；请只选普通正文。',readError:'无法读取选取内容，未转换任何数据。',convertError:'转换失败，以下保留原文。'},
 en:{open:'Traditional reader',title:'Traditional Chinese reader',hint:'Select ordinary text on the original page, then open this reader. The page and data are not modified.',privacy:'Processed only in this page memory; cleared on close. Selecting reader text copies displayed text. Copy original preserves the source.',original:'Original',traditional:'Traditional',copy:'Copy original',copied:'Original copied',copyFailed:'Clipboard unavailable. Switch to Original and copy manually.',close:'Close',empty:'No text selected. Close this panel, select text on the page, then reopen.',tooLong:'Selection exceeds 20,000 characters. Select a smaller range.',tooComplex:'Selection structure is too complex. Select a smaller range.',protected:'Selection includes code, links or editable content. Select ordinary prose only.',readError:'Cannot read the selection. No data was converted.',convertError:'Conversion failed; showing the original.'},
};
const css=`
.dsh-zhtw-reader-launch {position:fixed;right:16px;bottom:58px;z-index:60;pointer-events:auto;}
.dsh-zhtw-reader-button {font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 10px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;-webkit-app-region:no-drag;}
.dsh-zhtw-reader-button:hover,.dsh-zhtw-reader-button[aria-pressed="true"] {border-color:var(--dsw-alias-brand-primary);}
.dsh-zhtw-reader-button:focus-visible {outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}
.dsh-zhtw-reader-button:disabled {opacity:.5;cursor:default;}
.dsh-zhtw-reader-dialog {width:min(760px,calc(100vw - 40px));max-height:80vh;box-sizing:border-box;overflow:auto;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);pointer-events:auto;}
.dsh-zhtw-reader-dialog::backdrop {background:color-mix(in srgb,var(--dsw-alias-label-primary) 25%,transparent);}
.dsh-zhtw-reader-row {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dsh-zhtw-reader-title {font-size:18px;margin:0;flex:1;}
.dsh-zhtw-reader-hint {font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6;}
.dsh-zhtw-reader-content {white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;margin-top:16px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);max-height:48vh;overflow:auto;user-select:text;}
@media print {.dsh-zhtw-reader-launch,.dsh-zhtw-reader-dialog {display:none!important;}}
`;

export function installReader(ctx,React) {
 const h=React.createElement;
 const ns='lang-zhtw-reader';
 for(const [language,dict]of Object.entries(words))ctx.effect(()=>ctx.locale.register(ns,language,dict));
 const t=ctx.locale.bind(ns);
 let converter;
 const convert=value=>(converter??=Converter({from:'cn',to:'tw'}))(value);
 function Reader(){
  React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
  const [capture,setCapture]=React.useState(null);
  const [mode,setMode]=React.useState('traditional');
  const [notice,setNotice]=React.useState('');
  const dialog=React.useRef(null),launcher=React.useRef(null),generation=React.useRef(0);
  const titleId=React.useId();
  const takeSelection=()=>{try{if(globalThis.document?.activeElement?.closest(PROTECTED_SELECTION))return {error:'protected'};return captureSelection(window.getSelection());}catch{return {error:'readError'};}};
  const open=()=>{generation.current++;setCapture(takeSelection());setMode('traditional');setNotice('');};
  const clear=()=>{generation.current++;setCapture(null);setNotice('');};
  React.useEffect(()=>{
    if(!capture)return;
    const node=dialog.current;
    if(!node)return;
    node.showModal();
    return()=>{generation.current++;if(node.open)node.close();};
  },[capture]);
  const view=React.useMemo(()=>{
    if(!capture?.text)return {text:''};
    try{return {text:readerView(capture.text,mode,convert)};}catch{return {text:capture.text,error:'convertError'};}
  },[capture,mode]);
  const button=(label,props={})=>h('button',{type:'button',className:'dsh-zhtw-reader-button',...props},t(label));
  return h(React.Fragment,null,h('style',null,css),
   button('open',{className:'dsh-zhtw-reader-button dsh-zhtw-reader-launch',ref:launcher,title:t('hint'),onPointerDown:event=>{if(event.button===0)event.preventDefault();},onClick:open}),
   h('dialog',{ref:dialog,className:'dsh-zhtw-reader-dialog','aria-labelledby':titleId,onClose:()=>{clear();launcher.current?.focus();}},
    h('div',{className:'dsh-zhtw-reader-row'},h('h2',{id:titleId,className:'dsh-zhtw-reader-title'},t('title')),button('close',{autoFocus:true,onClick:()=>dialog.current?.close()})),
    h('p',{className:'dsh-zhtw-reader-hint'},t('privacy')),
    h('div',{className:'dsh-zhtw-reader-row'},
     button('original',{'aria-pressed':mode==='original',onClick:()=>setMode('original')}),
     button('traditional',{'aria-pressed':mode==='traditional',onClick:()=>setMode('traditional')}),
     button('copy',{disabled:!capture?.text,onClick:async()=>{const token=generation.current;try{await navigator.clipboard.writeText(capture.text);if(token===generation.current)setNotice('copied');}catch{if(token===generation.current)setNotice('copyFailed');}}})),
    h('p',{role:'status',className:'dsh-zhtw-reader-hint'},t(notice||view.error||capture?.error||'hint')),
    h('div',{className:'dsh-zhtw-reader-content',tabIndex:0},view.text)));
 }
 ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'lang-zhtw-reader',order:35},Reader));
}
