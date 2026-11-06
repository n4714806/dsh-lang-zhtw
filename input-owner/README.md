# Additive composer-owner API (not deployed)

## Deliverables

- [patch-owner.mjs](<patch-owner.mjs>): pure `patchOwnerSource(source)` generator. Returns patched JavaScript; performs no filesystem writes, installation, profile changes, or service calls. Rejects any source other than SHA-256 `fd8ee6c74845d017c2d0e2e6fb62fc655c42b084b1b014da08e1ef7355e3e984` and requires each insertion anchor exactly once.
- [load-captured-owner.mjs](<load-captured-owner.mjs>): test-only factory instrumentation exposing actual owner classes and their bundled Lexical implementation. Stubs DSH services/store; loads React, ReactDOM and Zod from existing root dependencies. Never invokes the plugin's `apply` or any live DSH service/profile.
- [owner.test.mjs](<owner.test.mjs>): actual bundled runtime and shell tests, not a mocked text editor.

## Public contract

```ts
interface CapturedInsertion {
  start: number; // detect coordinates, NOT clipboard/state.draft offsets
  end: number;
  draftRev: number;
}
interface InputActionsAddition {
  transformDraftText(
    transform: (text: string) => string,
    capturedSpan: CapturedInsertion,
  ): boolean | null;
}
```

Capture selection with `inputActions.captureInsertion()` before focus moves away. Invoke `inputActions.transformDraftText(convert, captured)` after user confirmation. Plugins need no access to `editor`, nodes, Lexical, or draft slicing. Feature-detect this additive method: an unpatched owner does not provide it. Do not substitute `insertText` or `setDraft` when it is absent.

`true` means conversion committed without an observed notification failure, or valid identity/no-text no-op; `false` means rejected before editing or confirmed rollback; `null` means commit or notification/undo bookkeeping is uncertain (including a committed edit whose listener threw). Handle `null` explicitly: do not report “no conversion,” retry, or fall back to another mutation. A subsequent listener's edits can supersede a committed conversion; success does not promise the draft is still identical to the conversion output. The callback is synchronous and must be pure. It receives each selected contiguous text run separated by atomic chips, with paragraph/linebreak newlines included. It never receives chip labels/tokens/reference payloads. A collapsed captured span means the entire current detect document; otherwise only its overlap is transformed. The owner refuses stale revisions, disposed sessions, adjudicating/submitting, IME composition, non-editable editor, invalid detect bounds, nested editor updates, and preexisting pending/queued edits. Pending/queued edits are also checked after callbacks; they are neither flushed into the conversion nor discarded.

All input runs are collected before callbacks, then all output is computed and validated before mutation. Limits count UTF-16 code units: 20,000 selected input characters excluding chips; 80,000 aggregate output characters. Outputs must be strings (not promises), cannot contain CR, U+FFFC, or legacy reference placeholders U+E100–U+E11D, and must preserve newline count in each run. Newlines are immutable structure: conversions that add/remove them reject the entire operation. Text pieces on either side of each newline are edited separately, preserving existing paragraph and linebreak nodes. Callback errors reject without partial conversion; state/guard checks run again after callbacks.

Only changed text ranges are replaced, last-to-first, in one owner `applyEdit(..., Co)` (`Co` is bundled `PASTE_TAG`). Chip keys, command claim object, reference metadata and attachment array are untouched. The final caret is the end of the converted selection (or document), adjusted for output length changes. Identity/no-text does not call `applyEdit` or move selection, so creates no undo entry. The method calls no send, submit, attachment or explicit persistence operation. Normal owner update, suggestion and draft-persistence behavior still runs as for ordinary editing.

### Failure semantics in the pinned bundle

The bundled update catch calls `_onError` before resetting `_pendingEditorState`. The actual owner's callback rethrows, which would prevent Lexical rollback. During only this synchronous operation, the additive method substitutes a nonthrowing callback and restores the exact original in `finally`. Lexical performs its own rollback and notifications; this method never resets editor state, clears history, or discards listener-enqueued edits.

The attempted state is captured inside the update. Lexical marks it read-only after core reconciliation but before notifications: that is evidence of commitment even when a later listener throws or replaces the current state. Otherwise, the original committed state plus a null pending state establishes rollback; remaining outcomes return `null`. This depends on the hash-pinned implementation, not a generic Lexical API guarantee. Errors are contained at this operation boundary, not forwarded back through the throwing callback.

The normal owner registers history before its projection listener and later consumer update listeners. A later update-listener exception therefore preserves the conversion's single undo entry. Arbitrary earlier mutation/text-content listeners can abort notification before history/projection listeners run; this patch conservatively reports `null`, even when commitment is known, because notification/undo bookkeeping may be incomplete. It does not replay skipped listeners or repair arbitrary third-party listener side effects. DOM reconciliation failure/unknown-result handling is conservative and not browser-tested here.

## Verification

Run from workspace root using existing dependencies:

```powershell
node --test input-owner/owner.test.mjs
```

Result: **15/15 passed**. Added real-bundle regression coverage for same-VM transform errors, restored error callback, absence of latent pending conversion after rollback/empty update, preserved prior undo and redo, postcommit update-listener errors with a single conversion undo, throwing rollback notifications, preexisting and converter-enqueued pending edits, and preservation of listener-enqueued newer edits. Coverage includes mixed command/reference chips, selection across chips, detect-vs-clipboard offset mismatch, shorter/longer output, full-draft collapsed span, paragraph and explicit linebreak identity, Unicode UTF-16 offsets, chip-only and empty selections, unchanged no-op, input/output limits, nonstring/async/throwing converters, newline/placeholder rejection, stale revisions, phase/disposal/IME/editability, post-conversion guard recheck, reentrant snapshot changes, attachments/claims/no-send, undo/redo, and typing immediately before/after conversion as separate undo units.

These are headless Node tests executing the exact captured factory's bundled Lexical and actual DraftEditorRuntime/SessionInputShell. Undo/redo are dispatched through real bundled Lexical commands. They establish one undo operation, **not** a browser keyboard-event/DOM selection or native IME integration test. No Desktop was installed, modified, restarted, or contacted. Live Client inspection timed out; exact implementation names and guards were read from the captured source. One initial test failed because the test assigned a getter-only machine state; the fixture was corrected to change its phase and publish, and all tests passed afterward.

Only this directory was authored. The captured source remains read-only. Deployment and upstream source/type integration are intentionally outside this deliverable.
