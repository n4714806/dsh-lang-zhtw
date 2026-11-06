import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { patchOwnerSource } from './patch-owner.mjs';
const require = createRequire(import.meta.url);

export function createSnapshotStore(initial) {
  let value = initial;
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, set: next => { value = next; for (const fn of listeners) fn(); } };
}

/** Test-only export seam; executes captured bundled Lexical, never another Lexical npm version. */
export async function loadCapturedOwner() {
  const original = await readFile(new URL('../research/ui-conversation-client.js', import.meta.url), 'utf8');
  const source = patchOwnerSource(original).replace('\t\treturn module.exports;', `
    module.exports.__ownerTest = { DraftEditorRuntime, SessionInputShell,
      $composerLayout, selectSpan, $replaceDetectSpanWithText,
      $createReferenceChipNode, $createCommandChipNode,
      root: nl, paragraph: es, text: Go, linebreak: qi,
      undo: Qe$2, redo: Ze$2, registerHistory: O, createHistory: z,
      selection: Kr, setSelection: ol, rangeSelection: Fr };
    return module.exports;`);
  let factory;
  const sandbox = { window: { __ModuleLoader__: { load: entry => { factory = entry.factory; } } }, console, setTimeout, clearTimeout, queueMicrotask, performance, AbortController, URL, TextEncoder, TextDecoder };
  vm.runInNewContext(source, sandbox, { filename: 'captured-owner.instrumented.js' });
  const exports = factory(name => {
    if (name === '@deepseek-ai/cordis') return { Service: class Service {} };
    if (name === '@deepseek-ai/dsh-client-store') return { createSnapshotStore };
    if (name.startsWith('@deepseek-ai/')) return {};
    return require(name);
  });
  return exports.__ownerTest;
}
