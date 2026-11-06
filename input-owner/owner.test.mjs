import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchOwnerSource } from './patch-owner.mjs';
import { loadCapturedOwner } from './load-captured-owner.mjs';

const api = await loadCapturedOwner();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
// Functions made by this constructor execute in the captured bundle's VM.
// Host-realm Errors do NOT exercise Lexical's `error instanceof Error` branch.
const ownerFunction = (...args) => api.DraftEditorRuntime.constructor(...args);
function runtime() {
  let editor;
  editor = new api.DraftEditorRuntime({ onUpdate: () => editor.refreshProjection(), openReference: () => false, lexicon: () => new Map(), resolveLexicon: () => undefined });
  const dispose = editor.register();
  return { editor, dispose };
}
const select = (r, start, end = start) => r.applyEdit(() => api.selectSpan(api.$composerLayout(), { start, end }));
const snapshot = r => JSON.stringify(r.editor.getEditorState().toJSON());
const chips = r => r.editor.getEditorState().read(() => api.$composerLayout().segments.filter(s => s.kind === 'chip').map(s => ({ key: s.node.getKey(), json: s.node.exportJSON() })));
function seedMixed(r) {
  r.applyEdit(() => {
    const root = api.root(); root.clear();
    root.append(api.paragraph().append(
      api.$createCommandChipNode({ token: '/cmd ', name: 'cmd', marker: 'claim', submit: () => { throw new Error('must not send'); } }),
      api.text(' 汉语'),
      api.$createReferenceChipNode({ source: 'files', ref: '/tmp/汉字.md', label: '汉字.md', clipboardText: '@汉字.md' }),
      api.text(' 软件'), api.linebreak(), api.text('网络')),
      api.paragraph().append(api.text('台湾')));
    root.selectEnd();
  });
}
const convert = text => text.replaceAll('汉', '漢').replaceAll('语', '語').replaceAll('软件', '軟體').replaceAll('网络', '網路').replaceAll('台湾', '臺灣');

test('pure source generator pins exact captured bytes and is additive', async () => {
  const source = await readFile(new URL('../research/ui-conversation-client.js', import.meta.url), 'utf8');
  const patched = patchOwnerSource(source);
  assert.ok(patched.length > source.length);
  assert.throws(() => patchOwnerSource(source + '\n'), /SHA-256/);
  assert.throws(() => patchOwnerSource(patched), /SHA-256/);
});

test('real bundled owner converts entire mixed draft; chips, structural breaks and one undo preserved', async () => {
  const { editor: r, dispose } = runtime();
  try {
    seedMixed(r); select(r, 2);
    const before = snapshot(r), beforeChips = JSON.stringify(chips(r));
    const beforeText = r.projection.detectText;
    const blockKeys = () => r.editor.getEditorState().read(() => api.root().getChildren().map(n => n.getKey()));
    const blocks = JSON.stringify(blockKeys());
    const lineKeys = () => r.editor.getEditorState().read(() => api.$composerLayout().segments.filter(s => s.kind === 'linebreak').map(s => s.node.getKey()));
    const lines = JSON.stringify(lineKeys());
    assert.equal(r.transformDraftText(convert, { start: 2, end: 2 }), true);
    assert.equal(r.projection.detectText, convert(beforeText));
    assert.equal(JSON.stringify(chips(r)), beforeChips);
    assert.equal(JSON.stringify(blockKeys()), blocks);
    assert.equal(JSON.stringify(lineKeys()), lines);
    assert.equal(r.projection.caret, r.projection.detectText.length);
    r.editor.dispatchCommand(api.undo); await tick();
    assert.equal(snapshot(r), before);
    r.editor.dispatchCommand(api.redo); await tick();
    assert.equal(r.projection.detectText, convert(beforeText));
  } finally { dispose(); }
});

test('partial detect selection across chips changes overlap only, even with length changes', () => {
  const { editor: r, dispose } = runtime();
  try {
    seedMixed(r);
    const before = r.projection.detectText, c = JSON.stringify(chips(r));
    const start = before.indexOf('语'), end = before.indexOf('件');
    assert.equal(r.transformDraftText(s => s.replace('语', '語言').replace('软', '軟體'), { start, end }), true);
    assert.equal(r.projection.detectText, before.slice(0, start) + before.slice(start, end).replace('语', '語言').replace('软', '軟體') + before.slice(end));
    assert.equal(JSON.stringify(chips(r)), c);
    assert.equal(r.projection.caret, end + 2);
  } finally { dispose(); }
});

test('identity and chip-only spans do not update or create undo entries', () => {
  const { editor: r, dispose } = runtime();
  try {
    seedMixed(r);
    const state = r.editor.getEditorState();
    let updates = 0; const off = r.editor.registerUpdateListener(() => updates++);
    assert.equal(r.transformDraftText(s => s, { start: 0, end: 0 }), true);
    assert.equal(r.transformDraftText(() => { throw new Error('chip must never be passed'); }, { start: 0, end: 1 }), true);
    assert.equal(r.editor.getEditorState(), state); assert.equal(updates, 0); off();
  } finally { dispose(); }
});

test('all conversion output is validated before mutation; throwing later run is atomic', () => {
  const { editor: r, dispose } = runtime();
  try {
    seedMixed(r);
    for (const fn of [() => undefined, () => Promise.resolve('x'), () => 'x'.repeat(80001), () => '\uFFFC', () => '\uE100', () => '\r', () => 'changed\n\n\n']) {
      const state = r.editor.getEditorState();
      assert.equal(r.transformDraftText(fn, { start: 0, end: 0 }), false);
      assert.equal(r.editor.getEditorState(), state);
    }
    const state = r.editor.getEditorState(); let calls = 0;
    assert.equal(r.transformDraftText(s => { if (++calls === 2) throw new Error('conversion failure'); return s + 'changed'; }, { start: 0, end: 0 }), false);
    assert.equal(calls, 2); assert.equal(r.editor.getEditorState(), state);
  } finally { dispose(); }
});

test('input and aggregate output bounds, invalid spans, IME and readonly guards', () => {
  const { editor: r, dispose } = runtime();
  try {
    r.setDraft('汉'.repeat(20001)); let calls = 0;
    assert.equal(r.transformDraftText(s => { calls++; return s; }, { start: 0, end: 0 }), false); assert.equal(calls, 0);
    assert.equal(r.transformDraftText(convert, { start: 0, end: 20000 }), true);
    for (const span of [{ start: -1, end: 2 }, { start: 2, end: 1 }, { start: 0, end: 99999 }, { start: NaN, end: 0 }, { start: 0.5, end: 1 }, null]) assert.equal(r.transformDraftText(convert, span), false);
    r.editor.setEditable(false); assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false); r.editor.setEditable(true);
    r.editor._compositionKey = 'test-ime'; assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false); r.editor._compositionKey = null;
    seedMixed(r); const state = r.editor.getEditorState();
    assert.equal(r.transformDraftText(s => s.includes('\n') ? 'a'.repeat(40000) + '\n\n' : 'a'.repeat(40000), { start: 0, end: 0 }), false);
    assert.equal(r.editor.getEditorState(), state);
  } finally { dispose(); }
});

test('public shell action guards phase/revision/disposal; preserves attachments and command claim; never sends', async () => {
  let sends = 0;
  const shell = new api.SessionInputShell({ defaultSink: () => { sends++; throw new Error('must not submit'); } });
  try {
    seedMixed(shell.draftEditor); shell.addAttachments(['attachment-1', 'attachment-2']);
    const attachments = shell.attachmentIds;
    const claim = shell.projection.command;
    const captured = shell.actions.captureInsertion();
    assert.equal(shell.actions.transformDraftText(convert, captured), true);
    assert.equal(shell.attachmentIds, attachments); assert.equal(shell.projection.command, claim); assert.equal(sends, 0);
    assert.equal(shell.actions.transformDraftText(convert, captured), false);
    for (const phase of ['adjudicating', 'submitting']) {
      const previous = shell.core.phase; shell.core.phase = phase; shell.publish();
      assert.equal(shell.actions.transformDraftText(convert, shell.actions.captureInsertion()), false);
      shell.core.phase = previous; shell.publish();
    }
    const next = shell.actions.captureInsertion(); shell.disposed = true;
    assert.equal(shell.actions.transformDraftText(convert, next), false); shell.disposed = false;
    shell.editor.setEditable(false); assert.equal(shell.actions.transformDraftText(convert, next), false); shell.editor.setEditable(true);
    shell.editor._compositionKey = 'ime'; assert.equal(shell.actions.transformDraftText(convert, next), false); shell.editor._compositionKey = null;
    const before = shell.editor.getEditorState();
    assert.equal(shell.actions.transformDraftText(s => { shell.disposed = true; return s + 'x'; }, next), false);
    assert.equal(shell.editor.getEditorState(), before); shell.disposed = false;
    assert.equal(sends, 0);
  } finally { shell.unregister(); }
});

test('deletions, expansions, empty drafts, and structural-only selections are safe', async () => {
  const { editor: r, dispose } = runtime();
  try {
    r.setDraft('');
    assert.equal(r.transformDraftText(() => { throw new Error('empty draft must not call converter'); }, { start: 0, end: 0 }), true);
    seedMixed(r);
    const original = r.projection.detectText;
    const chipState = JSON.stringify(chips(r));
    assert.equal(r.transformDraftText(s => s.replace(/[^\n]/gu, ''), { start: 0, end: original.length }), true);
    assert.equal(r.projection.detectText, original.replace(/[^\n\uFFFC]/gu, ''));
    assert.equal(JSON.stringify(chips(r)), chipState);
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, original);
    const newline = original.indexOf('\n');
    assert.equal(r.transformDraftText(s => s, { start: newline, end: newline + 1 }), true);
    assert.equal(r.transformDraftText(() => '', { start: newline, end: newline + 1 }), false);
    r.setDraft('😀汉字e\u0301');
    assert.equal(r.transformDraftText(convert, { start: 2, end: 3 }), true);
    assert.equal(r.projection.detectText, '😀漢字e\u0301');
  } finally { dispose(); }
});

test('conversion refuses a changed editor snapshot and nested owner updates', () => {
  const { editor: r, dispose } = runtime();
  try {
    r.setDraft('汉');
    assert.equal(r.transformDraftText(s => { r.setDraft('newer'); return s + 'wrong'; }, { start: 0, end: 0 }), false);
    assert.equal(r.projection.detectText, 'newer');
    let applied;
    r.applyEdit(() => { applied = r.transformDraftText(convert, { start: 0, end: 0 }); });
    assert.equal(applied, false);
  } finally { dispose(); }
});

test('same-VM transform failure rolls back pending state, never leaks on next edit, and retains undo/redo', async () => {
  const { editor: r, dispose } = runtime();
  let off = () => {};
  try {
    r.setDraft('汉'); r.replaceText({ start: 1, end: 1 }, '语');
    const onError = r.editor._onError;
    const failure = ownerFunction('return new Error("same VM transform failure")')();
    assert.throws(() => onError(failure), error => error === failure);
    off = r.editor.registerNodeTransform(r.editor._nodes.get('text').klass,
      ownerFunction('failure', 'return node => { if (node.getTextContent().includes("漢")) throw failure; }')(failure));
    await tick(); // Registration itself dirties existing text nodes.
    const before = snapshot(r), state = r.editor.getEditorState();
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false);
    assert.equal(r.editor._onError, onError);
    assert.equal(r.editor.getEditorState(), state);
    assert.equal(r.editor._pendingEditorState, null);
    assert.equal(snapshot(r), before);
    assert.equal(r.projection.detectText, '汉语');
    off(); off = () => {};
    r.applyEdit(() => {}); await tick();
    assert.equal(snapshot(r), before, 'empty update must not commit latent converted state');
    r.editor.dispatchCommand(api.undo); await tick();
    assert.equal(r.projection.detectText, '汉');
    // Reject once more with an existing redo entry, which must survive rollback.
    off = r.editor.registerNodeTransform(r.editor._nodes.get('text').klass,
      ownerFunction('node', 'if (node.getTextContent().includes("漢")) throw new Error("again");'));
    await tick();
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false);
    off(); off = () => {};
    r.editor.dispatchCommand(api.redo); await tick();
    assert.equal(r.projection.detectText, '汉语');
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), true);
    r.editor.dispatchCommand(api.undo); await tick();
    assert.equal(r.projection.detectText, '汉语');
    r.editor.dispatchCommand(api.undo); await tick();
    assert.equal(r.projection.detectText, '汉');
  } finally { off(); dispose(); }
});

test('rollback remains complete when its notification listener also throws', async () => {
  const { editor: r, dispose } = runtime();
  let offTransform = () => {}, offListener = () => {};
  try {
    r.setDraft('汉');
    offTransform = r.editor.registerNodeTransform(r.editor._nodes.get('text').klass,
      ownerFunction('node', 'if (node.getTextContent().includes("漢")) throw new Error("transform");'));
    await tick();
    const state = r.editor.getEditorState(), onError = r.editor._onError;
    offListener = r.editor.registerUpdateListener(ownerFunction('throw new Error("rollback notification")'));
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false);
    assert.equal(r.editor.getEditorState(), state);
    assert.equal(r.editor._pendingEditorState, null);
    assert.equal(r.editor._onError, onError);
    offListener(); offListener = () => {};
    offTransform(); offTransform = () => {};
    r.applyEdit(() => {}); await tick();
    assert.equal(r.projection.detectText, '汉');
  } finally { offListener(); offTransform(); dispose(); }
});

test('postcommit update-listener exception reports uncertainty and late listener retains one undo', async () => {
  const { editor: r, dispose } = runtime();
  let off = () => {};
  try {
    r.setDraft('汉'); r.replaceText({ start: 1, end: 1 }, '语');
    const before = snapshot(r), onError = r.editor._onError;
    off = r.editor.registerUpdateListener(ownerFunction('throw new Error("postcommit listener")'));
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), null);
    assert.equal(r.projection.detectText, '漢語');
    assert.equal(r.editor._pendingEditorState, null);
    assert.equal(r.editor._onError, onError);
    off(); off = () => {};
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(snapshot(r), before);
    r.editor.dispatchCommand(api.redo); await tick(); assert.equal(r.projection.detectText, '漢語');
  } finally { off(); dispose(); }
});

test('pending unrelated edits are refused, not consumed or discarded, including converter side effects', async () => {
  const { editor: r, dispose } = runtime();
  try {
    r.setDraft('汉');
    const enqueue = () => r.editor.update(() => api.$replaceDetectSpanWithText({ start: 1, end: 1 }, '语'), { tag: 'history-push' });
    enqueue();
    const pending = r.editor._pendingEditorState;
    assert.ok(pending);
    let calls = 0;
    assert.equal(r.transformDraftText(s => { calls++; return convert(s); }, { start: 0, end: 0 }), false);
    assert.equal(calls, 0); assert.equal(r.editor._pendingEditorState, pending);
    await tick(); assert.equal(r.projection.detectText, '汉语');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, '汉');
    assert.equal(r.transformDraftText(s => { enqueue(); return convert(s); }, { start: 0, end: 0 }), false);
    await tick(); assert.equal(r.projection.detectText, '汉语');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, '汉');
  } finally { dispose(); }
});

test('throwing postcommit listener retains queued new edits instead of rolling them back', async () => {
  const { editor: r, dispose } = runtime();
  let off = () => {};
  try {
    r.setDraft('汉');
    off = r.editor.registerUpdateListener(() => {
      r.editor.update(() => api.$replaceDetectSpanWithText({ start: 1, end: 1 }, '!'), { tag: 'history-push' });
      throw new Error('queued a newer edit before failing');
    });
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), null);
    assert.equal(r.projection.detectText, '漢');
    assert.equal(r.editor._updates.length, 1);
    off(); off = () => {};
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), false);
    assert.equal(r.editor._updates.length, 1);
    r.applyEdit(() => {});
    assert.equal(r.projection.detectText, '漢!');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, '漢');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, '汉');
  } finally { off(); dispose(); }
});

test('typing immediately before and after conversion remains outside its undo boundary', async () => {
  const { editor: r, dispose } = runtime();
  try {
    r.setDraft('汉'); r.replaceText({ start: 1, end: 1 }, '语');
    const typed = r.projection.detectText;
    assert.equal(r.transformDraftText(convert, { start: 0, end: 0 }), true);
    r.replaceText({ start: 2, end: 2 }, '!');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, '漢語');
    r.editor.dispatchCommand(api.undo); await tick(); assert.equal(r.projection.detectText, typed);
  } finally { dispose(); }
});
