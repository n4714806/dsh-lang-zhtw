import {createReaderConverters} from './reader-converters.mjs';
import {captureSelection,readerView,PROTECTED_SELECTION,contextPointInSelection} from './reader-core.mjs';
const words={
 'zh-TW':{open:'繁簡閱讀',title:'繁簡閱讀面板',hint:'反白一般文字後按閱讀按鈕，或按右鍵顯示閱讀快捷列。',privacy:'只在本頁記憶體處理；關閉即清除。面板選取複製的是顯示文字；「複製原文」保留原文。',original:'原文',traditional:'繁體',simplified:'簡體',copy:'複製原文',copied:'已複製原文',copyFailed:'無法使用剪貼簿，請切換原文後手動複製。',close:'關閉',empty:'尚未選取文字。請關閉面板，在原頁反白後再開啟。',tooLong:'選取內容超過 20,000 字元，請縮小範圍。',tooComplex:'選取範圍結構太複雜，請縮小範圍。',protected:'選取包含程式碼、連結或編輯區；請只選一般內文。',readError:'無法讀取選取內容，未轉換任何資料。',convertError:'轉換失敗，以下保留原文。',selectionActions:'選取文字：閱讀快捷列',panelActions:'右鍵切換顯示',readTraditional:'轉為繁體閱讀',readSimplified:'轉為簡體閱讀',dismiss:'收起快捷列',nativeHint:'原生右鍵選單仍保留；收起原生選單後可使用此列。Shift＋右鍵只用原選單。'},
 zh:{open:'繁简阅读',title:'繁简阅读面板',hint:'选取普通文字后按阅读按钮，或右键显示阅读快捷栏。',privacy:'只在本页面内存处理；关闭即清除。面板选取复制的是显示文字；“复制原文”保留原文。',original:'原文',traditional:'繁体',simplified:'简体',copy:'复制原文',copied:'已复制原文',copyFailed:'无法使用剪贴板，请切换原文后手动复制。',close:'关闭',empty:'尚未选取文字。请关闭面板，在原页面选中后再打开。',tooLong:'选取内容超过 20,000 字符，请缩小范围。',tooComplex:'选取范围结构过于复杂，请缩小范围。',protected:'选取包含代码、链接或编辑区；请只选普通正文。',readError:'无法读取选取内容，未转换任何数据。',convertError:'转换失败，以下保留原文。',selectionActions:'选取文字：阅读快捷栏',panelActions:'右键切换显示',readTraditional:'转为繁体阅读',readSimplified:'转为简体阅读',dismiss:'收起快捷栏',nativeHint:'原生右键菜单仍保留；收起原生菜单后可使用此栏。Shift＋右键只用原菜单。'},
 en:{open:'Chinese reader',title:'Chinese reading panel',hint:'Select prose and open the reader, or right-click for reading actions.',privacy:'Processed only in page memory; cleared on close. Selecting reader text copies displayed text. Copy original preserves the source.',original:'Original',traditional:'Traditional',simplified:'Simplified',copy:'Copy original',copied:'Original copied',copyFailed:'Clipboard unavailable. Switch to Original and copy manually.',close:'Close',empty:'No text selected. Close, select prose on the page, then reopen.',tooLong:'Selection exceeds 20,000 characters. Select a smaller range.',tooComplex:'Selection structure is too complex. Select a smaller range.',protected:'Selection includes code, links or editable content. Select ordinary prose only.',readError:'Cannot read the selection. No data converted.',convertError:'Conversion failed; showing the original.',selectionActions:'Selected text: reading actions',panelActions:'Context reading actions',readTraditional:'Read in Traditional',readSimplified:'Read in Simplified',dismiss:'Dismiss reading actions',nativeHint:'The native context menu is preserved. Dismiss it to use these actions. Shift+right-click uses only the original menu.'},
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
.dsh-zhtw-reader-actions {padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);}
.dsh-zhtw-reader-page-actions {position:fixed;right:16px;bottom:102px;width:290px;max-width:calc(100vw - 32px);box-sizing:border-box;z-index:61;pointer-events:auto;}
.dsh-zhtw-reader-actions .dsh-zhtw-reader-hint {margin:4px 0 8px;}
@media print {.dsh-zhtw-reader-launch,.dsh-zhtw-reader-dialog,.dsh-zhtw-reader-page-actions {display:none!important;}}
`;
export function installReader(ctx,React) {
 const h=React.createElement,ns='lang-zhtw-reader';
 for(const [language,dict]of Object.entries(words))ctx.effect(()=>ctx.locale.register(ns,language,dict));
 const t=ctx.locale.bind(ns),converters=createReaderConverters();
 function Reader(){
  React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
  const [capture,setCapture]=React.useState(null),[mode,setMode]=React.useState('traditional'),[notice,setNotice]=React.useState('');
  const [pageSelection,setPageSelection]=React.useState(null),[panelActions,setPanelActions]=React.useState(false);
  const dialog=React.useRef(null),launcher=React.useRef(null),generation=React.useRef(0),pageActions=React.useRef(null),content=React.useRef(null);
  const titleId=React.useId();
  const takeSelection=()=>{try{if(globalThis.document?.activeElement?.closest(PROTECTED_SELECTION))return {error:'protected'};return captureSelection(window.getSelection());}catch{return {error:'readError'};}};
  const open=(selected=takeSelection(),nextMode='traditional')=>{generation.current++;setPageSelection(null);setPanelActions(false);setCapture(selected);setMode(nextMode);setNotice('');};
  const clear=()=>{generation.current++;setCapture(null);setNotice('');setPageSelection(null);setPanelActions(false);};
  const choose=(nextMode,restoreFocus=false)=>{setMode(nextMode);setPanelActions(false);setNotice('');if(restoreFocus)content.current?.focus();};
  const openPending=nextMode=>{
   try{
    const selection=window.getSelection(),bounds=pageSelection?.bounds;
    if(!bounds||selection?.isCollapsed||selection?.rangeCount!==1||!bounds[0].isConnected||!bounds[2].isConnected)throw Error('Stale selection');
    const range=selection.getRangeAt(0);
    if(range.startContainer!==bounds[0]||range.startOffset!==bounds[1]||range.endContainer!==bounds[2]||range.endOffset!==bounds[3])throw Error('Changed selection');
    const fresh=takeSelection();if(!fresh.text||fresh.text!==pageSelection.text)throw Error('Changed content');
    open({text:fresh.text},nextMode);
   }catch{open({error:'readError'},'original');}
  };
  // Observe only explicit right-clicks. Never cancel native context menus or focus
  // a competing popup; the user opts into the separately rendered action strip.
  React.useEffect(()=>{
   const onContext=event=>{
    setPageSelection(null);
    if(event.defaultPrevented||event.shiftKey||dialog.current?.open)return;
    const target=event.target?.nodeType===1?event.target:event.target?.parentElement;
    if(target?.closest(PROTECTED_SELECTION+',.dsh-zhtw-reader-launch,.dsh-zhtw-reader-actions'))return;
    try{const selection=window.getSelection();if(!contextPointInSelection(selection,event))return;const selected=takeSelection();if(selected.text){const range=selection.getRangeAt(0);setPageSelection({text:selected.text,bounds:[range.startContainer,range.startOffset,range.endContainer,range.endOffset]});}}catch{}
   };
   const onPointer=event=>{if(!pageActions.current?.contains(event.target))setPageSelection(null);};
   const dismiss=()=>setPageSelection(null),onVisibility=()=>{if(document.hidden)dismiss();};
   document.addEventListener('contextmenu',onContext);document.addEventListener('pointerdown',onPointer,true);
   document.addEventListener('scroll',dismiss,true);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('resize',dismiss);
   return()=>{document.removeEventListener('contextmenu',onContext);document.removeEventListener('pointerdown',onPointer,true);document.removeEventListener('scroll',dismiss,true);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('resize',dismiss);};
  },[]);
  React.useEffect(()=>{
   if(!capture)return;const node=dialog.current;if(!node)return;
   node.showModal();return()=>{generation.current++;if(node.open)node.close();};
  },[capture]);
  // This open capture exclusively owns both cached results. Closing releases them.
  const views=React.useMemo(()=>Object.create(null),[capture]);
  const view=React.useMemo(()=>{
   if(!capture?.text)return {text:''};if(Object.hasOwn(views,mode))return views[mode];
   try{return views[mode]={text:readerView(capture.text,mode,converters)};}catch{return views[mode]={text:capture.text,error:'convertError'};}
  },[capture,mode,views]);
  const button=(label,props={})=>h('button',{type:'button',className:'dsh-zhtw-reader-button','data-reader-action':label,...props},t(label));
  const toolbarKeys=(event,dismiss)=>{
   const buttons=Array.from(event.currentTarget.querySelectorAll('button:not(:disabled)')),index=buttons.indexOf(document.activeElement);
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();return;}
   let next;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%buttons.length;
   else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+buttons.length)%buttons.length;
   else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;
   if(next!==undefined){event.preventDefault();buttons[next]?.focus();}
  };
  const dismissPage=()=>{setPageSelection(null);launcher.current?.focus();},dismissPanel=()=>{setPanelActions(false);content.current?.focus();};
  return h(React.Fragment,null,h('style',null,css),
   button('open',{className:'dsh-zhtw-reader-button dsh-zhtw-reader-launch',ref:launcher,title:t('hint'),onPointerDown:event=>{if(event.button===0)event.preventDefault();},onClick:()=>open()}),
   pageSelection&&h('section',{ref:pageActions,className:'dsh-zhtw-reader-actions dsh-zhtw-reader-page-actions','aria-label':t('selectionActions')},
    h('p',{className:'dsh-zhtw-reader-hint'},t('selectionActions')),
    h('div',{role:'toolbar','aria-label':t('selectionActions'),className:'dsh-zhtw-reader-row',onKeyDown:event=>toolbarKeys(event,dismissPage)},
     button('readTraditional',{onPointerDown:event=>event.preventDefault(),onClick:()=>openPending('traditional')}),button('readSimplified',{onPointerDown:event=>event.preventDefault(),onClick:()=>openPending('simplified')}),button('dismiss',{onClick:dismissPage})),
    h('p',{className:'dsh-zhtw-reader-hint'},t('nativeHint'))),
   h('dialog',{ref:dialog,className:'dsh-zhtw-reader-dialog','aria-labelledby':titleId,
    onClose:()=>{clear();launcher.current?.focus();},onCancel:event=>{if(panelActions){event.preventDefault();dismissPanel();}},
    onContextMenu:event=>{if(!event.defaultPrevented&&!event.shiftKey&&capture?.text)setPanelActions(true);else setPanelActions(false);}},
    h('div',{className:'dsh-zhtw-reader-row'},h('h2',{id:titleId,className:'dsh-zhtw-reader-title'},t('title')),button('close',{autoFocus:true,onClick:()=>dialog.current?.close()})),
    h('p',{className:'dsh-zhtw-reader-hint'},t('privacy')),
    h('div',{className:'dsh-zhtw-reader-row'},
     ...['original','traditional','simplified'].map(next=>button(next,{'aria-pressed':mode===next,onClick:()=>choose(next)})),
     button('copy',{disabled:!capture?.text,onClick:async()=>{const token=generation.current;try{await navigator.clipboard.writeText(capture.text);if(token===generation.current)setNotice('copied');}catch{if(token===generation.current)setNotice('copyFailed');}}})),
    panelActions&&h('section',{className:'dsh-zhtw-reader-actions dsh-zhtw-reader-panel-actions'},
     h('p',{className:'dsh-zhtw-reader-hint'},t('panelActions')),
     h('div',{role:'toolbar','aria-label':t('panelActions'),className:'dsh-zhtw-reader-row',onKeyDown:event=>toolbarKeys(event,dismissPanel)},
      ...['original','traditional','simplified'].map(next=>button(next,{onClick:()=>choose(next,true)})),button('dismiss',{onClick:dismissPanel})),
     h('p',{className:'dsh-zhtw-reader-hint'},t('nativeHint'))),
    h('p',{role:'status',className:'dsh-zhtw-reader-hint'},t(notice||view.error||capture?.error||'hint')),
    h('div',{ref:content,className:'dsh-zhtw-reader-content',tabIndex:0},view.text)));
 }
 ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'lang-zhtw-reader',order:35},Reader));
}
