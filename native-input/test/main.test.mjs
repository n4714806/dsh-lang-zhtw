import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { attachNativeComposerMenu, AVAILABILITY_CHANNEL, EVENT_CHANNEL } from '../src/native-composer-main.mjs';
import { patchDesktop } from '../src/patch-desktop.mjs';

function fixture() {
  const ipcMain = new EventEmitter(), wc = new EventEmitter(), window = new EventEmitter();
  const packets = [];
  window.webContents = wc;
  window.isDestroyed = () => false;
  wc.isDestroyed = () => false;
  wc.mainFrame = { url: 'dsh-app://app/chat' };
  wc.send = (channel, packet) => packets.push({ channel, packet });
  const api = attachNativeComposerMenu({ window, ipcMain });
  const event = () => ({ sender: wc, senderFrame: wc.mainFrame });
  const available = (revision = 1, value = true) => ipcMain.emit(AVAILABILITY_CHANNEL, event(), { available: value, revision });
  const params = (overrides = {}) => ({ frame: wc.mainFrame, isEditable: true, selectionText: '', linkURL: '', formControlType: 'none', ...overrides });
  return { ipcMain, wc, window, packets, api, event, available, params };
}
const actions = menu => menu.items.filter(item => item.click);

test('empty collapsed selection enables whole composer; preserves original items; no text IPC', () => {
  const f = fixture(), original = [{ role: 'undo' }, { role: 'paste' }];
  assert.equal(f.api.prepare(original, f.params()).items, original);
  f.available();
  const menu = f.api.prepare(original, f.params({ selectionText: 'SECRET DRAFT', html: '<b>SECRET</b>' }));
  assert.deepEqual(menu.items.slice(0, 2), original);
  assert.equal(menu.items[0], original[0]);
  assert.deepEqual(actions(menu).map(i => i.label), ['轉為繁體', '轉為簡體']);
  const id = f.packets[0].packet.menuId;
  assert.deepEqual(f.packets, [{ channel: EVENT_CHANNEL, packet: { kind: 'open', menuId: id } }]);
  actions(menu)[0].click(); actions(menu)[1].click(); actions(menu)[0].click();
  menu.closed(); menu.closed();
  assert.deepEqual(f.packets.map(i => i.packet), [{ kind: 'open', menuId: id }, { kind: 'action', menuId: id, mode: 'traditional' }, { kind: 'close', menuId: id }]);
  const collapsed = f.api.prepare([], f.params());
  assert.equal(actions(collapsed).length, 2);
  assert.ok(f.packets.at(-1).packet.menuId > id);
  assert.ok(!JSON.stringify(f.packets).includes('SECRET'));
  f.api.dispose();
});

test('only owning trusted editable non-form non-link main frame is eligible', () => {
  const f = fixture(); f.available();
  for (const overrides of [{ isEditable: false }, { isEditable: 1 }, { linkURL: 'https://example.com' }, { frame: { url: f.wc.mainFrame.url } }, ...['input', 'password', 'textarea', 'text', '', null].map(formControlType => ({ formControlType }))]) {
    const items = [{ role: 'copy' }];
    assert.equal(f.api.prepare(items, f.params(overrides)).items, items);
  }
  assert.equal(f.packets.length, 0);
  assert.equal(actions(f.api.prepare([], f.params({ formControlType: undefined }))).length, 2);
  for (const url of ['https://app/', 'dsh-app://other/', 'dsh-app://app.evil/', 'dsh-app://app:42/', 'dsh-app://user@app/', 'not a url']) {
    f.wc.mainFrame.url = url;
    assert.equal(actions(f.api.prepare([], f.params())).length, 0);
  }
  f.api.dispose();
});

test('availability authenticates sender/frame and validates revisions', () => {
  const f = fixture();
  for (const payload of [null, {}, { available: 1, revision: 1 }, ...[-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'].map(revision => ({ available: true, revision }))]) {
    f.ipcMain.emit(AVAILABILITY_CHANNEL, f.event(), payload);
    assert.equal(actions(f.api.prepare([], f.params())).length, 0);
  }
  for (const event of [{ sender: {}, senderFrame: f.wc.mainFrame }, { sender: f.wc, senderFrame: { url: f.wc.mainFrame.url } }]) f.ipcMain.emit(AVAILABILITY_CHANNEL, event, { available: true, revision: 1 });
  assert.equal(actions(f.api.prepare([], f.params())).length, 0);
  f.available(0);
  const menu = f.api.prepare([], f.params());
  f.available(0, false); // conflicting replay ignored
  actions(menu)[0].click();
  assert.equal(f.packets.at(-1).packet.kind, 'action');
  f.api.dispose();
});

test('roster changes invalidate old callbacks and stale revisions cannot revive them', () => {
  const f = fixture(); f.available(2);
  const menu = f.api.prepare([], f.params());
  f.available(3); f.available(2);
  actions(menu)[0].click();
  assert.equal(f.packets.length, 1);
  menu.closed();
  assert.equal(f.packets.at(-1).packet.kind, 'close');
  const fresh = f.api.prepare([], f.params());
  f.available(4, false);
  actions(fresh)[0].click();
  assert.equal(f.packets.at(-1).packet.kind, 'open');
  f.api.dispose();
});

test('closed and superseded menus cannot act', () => {
  const f = fixture(); f.available();
  const first = f.api.prepare([], f.params());
  const second = f.api.prepare([], f.params());
  actions(first)[0].click();
  second.closed(); actions(second)[1].click();
  assert.deepEqual(f.packets.map(i => i.packet.kind), ['open', 'close', 'open', 'close']);
  f.api.dispose();
});

test('navigation, crash, frame replacement and URL changes invalidate menus', () => {
  for (const invalidate of [
    f => f.wc.emit('did-start-navigation', {}, 'dsh-app://app/new', false, true),
    f => f.wc.emit('did-navigate'),
    f => f.wc.emit('render-process-gone'),
    f => { f.wc.mainFrame = { url: 'dsh-app://app/chat' }; },
    f => { f.wc.mainFrame.url = 'dsh-app://app/new'; },
  ]) {
    const f = fixture(); f.available();
    const menu = f.api.prepare([], f.params());
    invalidate(f); actions(menu)[0].click(); menu.closed();
    assert.equal(f.packets.length, 1);
    f.api.dispose();
  }
  const f = fixture(); f.available(20); f.wc.emit('did-navigate');
  assert.equal(actions(f.api.prepare([], f.params())).length, 0);
  f.available(1);
  assert.equal(actions(f.api.prepare([], f.params())).length, 2);
  f.api.dispose();
});

test('same-document navigation invalidates old menu but retains live subscription capability', () => {
  const f = fixture(); f.available();
  const old = f.api.prepare([], f.params());
  f.wc.emit('did-start-navigation', {}, 'dsh-app://app/chat#anchor', true, true);
  f.wc.mainFrame.url = 'dsh-app://app/chat#anchor';
  actions(old)[0].click();
  assert.equal(f.packets.filter(p => p.packet.kind === 'action').length, 0);
  const fresh = f.api.prepare([], f.params());
  assert.equal(actions(fresh).length, 2); actions(fresh)[0].click();
  assert.equal(f.packets.at(-1).packet.kind, 'action'); f.api.dispose();
});

test('subframe navigation does not reset; destruction and close clean every listener', () => {
  for (const trigger of [f => f.wc.emit('destroyed'), f => f.window.emit('closed'), f => f.api.dispose()]) {
    const f = fixture(); f.available();
    f.wc.emit('did-start-navigation', {}, 'https://example.com', false, false);
    const menu = f.api.prepare([], f.params());
    assert.equal(actions(menu).length, 2);
    trigger(f); f.api.dispose(); actions(menu)[0].click(); menu.closed();
    assert.equal(f.packets.length, 1);
    assert.equal(f.ipcMain.listenerCount(AVAILABILITY_CHANNEL), 0);
    for (const name of ['did-start-navigation', 'did-navigate', 'render-process-gone', 'destroyed']) assert.equal(f.wc.listenerCount(name), 0);
    assert.equal(f.window.listenerCount('closed'), 0);
  }
});

test('send destruction race fails closed', () => {
  const f = fixture(); f.available(); f.wc.send = () => { throw Error('gone'); };
  assert.equal(actions(f.api.prepare([], f.params())).length, 0);
  f.api.dispose();
});

test('pure baseline patch preserves native roles, gate, and popup lifecycle; refuses drift', async () => {
  const baseline = new URL('../baseline/lib/', import.meta.url);
  const [main, preload, helper] = await Promise.all([
    readFile(new URL('main.js', baseline), 'utf8'), readFile(new URL('preload-app.cjs', baseline), 'utf8'),
    readFile(new URL('../src/native-composer-preload.mjs', import.meta.url), 'utf8'),
  ]);
  const patched = patchDesktop(main, preload, helper);
  assert.match(patched.main, /import \{ attachNativeComposerMenu \} from "\.\/native-composer-main.mjs"/);
  assert.match(patched.main, /popup\(\{ window, callback: menuPatch.closed \}\)/);
  const roles = main.slice(main.indexOf('\t\tif (isEditable) items.push('), main.indexOf('\t\tif (items.length > 0) {', main.indexOf('window.webContents.on("context-menu"')));
  assert.ok(patched.main.includes(roles));
  const gate = preload.split('\n').find(line => line.includes('exposeInMainWorld("dshDesktop",'));
  assert.ok(patched.preload.includes(gate));
  assert.match(patched.preload, /composerConversion: createNativeComposerBridge\(electron.ipcRenderer\)/);
  assert.doesNotMatch(patched.preload + patched.main, /dsh:reader:|native-reader|createNativeReaderBridge/);
  new vm.Script(patched.preload);
  for (const [m, p, h] of [[main + '\nimport { createRequire } from "node:module";', preload, helper], [main.replace('(_event, { isEditable, selectionText, editFlags })', '(_event, params)'), preload, helper], [main, preload.replace('process.isMainFrame', 'true'), helper], [main, preload, helper + helper], [patched.main, patched.preload, helper]]) assert.throws(() => patchDesktop(m, p, h));
});
