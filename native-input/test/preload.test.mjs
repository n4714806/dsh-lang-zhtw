import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createNativeComposerBridge } from '../src/native-composer-preload.mjs';
const AVAILABILITY = 'dsh:composer-conversion:availability:v1';
const EVENT = 'dsh:composer-conversion:event:v1';
function fixture() {
  const ipc = new EventEmitter(), sent = [];
  ipc.send = (channel, packet) => sent.push({ channel, packet });
  return { ipc, sent, bridge: createNativeComposerBridge(ipc) };
}

test('frozen minimal bridge, duplicate subscriptions and idempotent disposal', () => {
  const { ipc, sent, bridge } = fixture();
  assert.ok(Object.isFrozen(bridge));
  assert.deepEqual(Object.keys(bridge), ['version', 'subscribe']);
  assert.equal(bridge.version, 1);
  assert.throws(() => bridge.subscribe(null), TypeError);
  const got = [], listener = p => got.push(p);
  const a = bridge.subscribe(listener), b = bridge.subscribe(listener);
  assert.equal(ipc.listenerCount(EVENT), 1);
  ipc.emit(EVENT, { sender: 'not exposed' }, { kind: 'open', menuId: 1 });
  assert.equal(got.length, 2);
  a(); a();
  assert.equal(ipc.listenerCount(EVENT), 1);
  ipc.emit(EVENT, {}, { kind: 'close', menuId: 1 });
  assert.equal(got.length, 3);
  b(); b();
  assert.equal(ipc.listenerCount(EVENT), 0);
  const c = bridge.subscribe(listener); c();
  assert.deepEqual(sent, [true, true, true, false, true, false].map((available, index) => ({ channel: AVAILABILITY, packet: { available, revision: index + 1 } })));
});

test('valid packets are rebuilt minimally and frozen; callback errors isolated', () => {
  const { ipc, bridge } = fixture(), got = [];
  bridge.subscribe(() => { throw new Error('SECRET'); });
  bridge.subscribe((...args) => got.push(args));
  for (const value of [{ kind: 'open', menuId: 1 }, { kind: 'action', menuId: 1, mode: 'traditional' }, { kind: 'action', menuId: 2, mode: 'simplified' }, { kind: 'close', menuId: 2 }]) {
    ipc.emit(EVENT, { sender: 'SECRET' }, { ...value, draft: 'SECRET', html: '<b>SECRET</b>', selectionText: 'SECRET' });
    const args = got.at(-1);
    assert.equal(args.length, 1);
    assert.deepEqual(args[0], value);
    assert.ok(Object.isFrozen(args[0]));
  }
  assert.ok(!JSON.stringify(got).includes('SECRET'));
});

test('reject malformed kinds, IDs, modes and unrecognized channels', () => {
  const { ipc, bridge } = fixture(), got = [];
  bridge.subscribe(packet => got.push(packet));
  for (const value of [null, {}, { kind: 'unknown', menuId: 1 }, { kind: 'action', menuId: 1 }, { kind: 'action', menuId: 1, mode: 'original' }, ...[0, -1, 0.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(menuId => ({ kind: 'open', menuId }))]) ipc.emit(EVENT, {}, value);
  ipc.emit('dsh:reader:action:v1', {}, { kind: 'open', menuId: 1 });
  assert.deepEqual(got, []);
});

test('reentrant roster change skips removed listener without adding new callbacks mid-dispatch', () => {
  const { ipc, sent, bridge } = fixture(), got = [];
  let b, c;
  const a = bridge.subscribe(() => { got.push('a'); b(); c ??= bridge.subscribe(() => got.push('c')); });
  b = bridge.subscribe(() => got.push('b'));
  ipc.emit(EVENT, {}, { kind: 'open', menuId: 1 });
  assert.deepEqual(got, ['a']);
  assert.deepEqual(sent.map(i => i.packet.revision), [1, 2, 3, 4]);
  ipc.emit(EVENT, {}, { kind: 'close', menuId: 1 });
  assert.deepEqual(got, ['a', 'a', 'c']);
  a(); c();
  assert.equal(ipc.listenerCount(EVENT), 0);
});
