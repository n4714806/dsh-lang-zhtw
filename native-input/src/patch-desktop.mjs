function replaceOnce(text, needle, replacement) {
  const start = text.indexOf(needle);
  if (start < 0 || text.indexOf(needle, start + 1) >= 0) throw new Error('Desktop 0.2.1-rc.5 patch anchor must occur exactly once');
  return text.slice(0, start) + replacement + text.slice(start + needle.length);
}

/** Pure source transformation. No installed paths, filesystem writes, or reader bridge. */
export function patchDesktop(main, preload, preloadHelper) {
  if (![main, preload, preloadHelper].every(value => typeof value === 'string')) throw new TypeError('Desktop patch sources must be strings');
  if (/native-composer-main|native-reader-main/.test(main) || /createNative(?:Composer|Reader)Bridge/.test(preload)) throw new Error('Desktop source already contains a native conversion bridge');
  const helper = replaceOnce(preloadHelper, 'export function createNativeComposerBridge(ipcRenderer)', 'function createNativeComposerBridge(ipcRenderer)');
  if (/\b(?:import|export)\s/.test(helper)) throw new Error('Preload helper must be self-contained');
  // Assert the original security gate exists uniquely without modifying it.
  const gate = 'electron.contextBridge.exposeInMainWorld("dshDesktop", location.protocol === `dsh-app:` && location.hostname === "app" && process.isMainFrame ? createProductApi() : { protocolVersion: 1 });';
  replaceOnce(preload, gate, gate);
  main = replaceOnce(main, 'import { createRequire } from "node:module";', 'import { attachNativeComposerMenu } from "./native-composer-main.mjs";\nimport { createRequire } from "node:module";');
  main = replaceOnce(main, '\twindow.webContents.on("context-menu", (_event, { isEditable, selectionText, editFlags }) => {', '\tconst nativeComposerPatch = attachNativeComposerMenu({ window, ipcMain });\n\twindow.webContents.on("context-menu", (_event, params) => {\n\t\tconst { isEditable, selectionText, editFlags } = params;');
  main = replaceOnce(main, '\t\tif (items.length > 0) {\n\t\t\tconst messages = currentDesktopLocale().messages;\n\t\t\tMenu.buildFromTemplate(items.map((item) => ({', '\t\tconst menuPatch = nativeComposerPatch.prepare(items, params);\n\t\tif (menuPatch.items.length > 0) {\n\t\t\tconst messages = currentDesktopLocale().messages;\n\t\t\tMenu.buildFromTemplate(menuPatch.items.map((item) => ({');
  main = replaceOnce(main, '\t\t\t}))).popup({ window });', '\t\t\t}))).popup({ window, callback: menuPatch.closed });');
  preload = replaceOnce(preload, 'function createProductApi() {', helper + '\nfunction createProductApi() {');
  preload = replaceOnce(preload, '\t\tprotocolVersion: 1,\n\t\tbrowser: createDesktopBrowserBridge(),', '\t\tprotocolVersion: 1,\n\t\tcomposerConversion: createNativeComposerBridge(electron.ipcRenderer),\n\t\tbrowser: createDesktopBrowserBridge(),');
  return { main, preload };
}
