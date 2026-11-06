import { createHash } from 'node:crypto';

export const INPUT_SHA256 = 'fd8ee6c74845d017c2d0e2e6fb62fc655c42b084b1b014da08e1ef7355e3e984';
export const API_ANCHOR = '\t\t\t\tinsertText: (text, span) => {';
export const RUNTIME_ANCHOR = '\t\t\tinsertAsyncText(span, text) {';

const action = `				/** Transform selected text, or all text for a collapsed captured detect span. */
				transformDraftText: (transform, capturedSpan) => {
					const allowed = () => !this.disposed && this.snapshot.phase !== "adjudicating" && this.snapshot.phase !== "submitting" && capturedSpan?.draftRev === this.rev && !this.editor.isComposing() && this.editor.isEditable();
					if (!allowed()) return false;
					return this.draftEditor.transformDraftText(transform, capturedSpan, allowed);
				},
`;

const runtime = `			/**
			* Synchronous, bounded text-only conversion. Chips and structural newlines
			* are immutable. Convert chip-separated runs before entering an edit;
			* reject invalid results without any mutation or history entry.
			* true = committed/no-op, false = rejected/rolled back, null = unknown.
			* Never retry an unknown result automatically.
			*/
			transformDraftText(transform, capturedSpan, allowed = () => true) {
				// A discrete update would otherwise absorb unrelated pending typing.
				const idle = () => !this.editor._updating && this.editor._pendingEditorState === null && this.editor._updates.length === 0;
				if (typeof transform !== "function" || !capturedSpan || this.editor.isComposing() || !this.editor.isEditable() || !idle()) return false;
				const state = this.editor.getEditorState();
				let plan;
				try {
					plan = state.read(() => {
						const layout = $composerLayout();
						let { start, end } = capturedSpan;
						if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > layout.detectLength) return null;
						if (start === end) { start = 0; end = layout.detectLength; }
						const runs = [];
						let run = null;
						let inputLength = 0;
						for (const segment of layout.segments) {
							if (segment.kind === "chip") { run = null; continue; }
							const from = Math.max(start, segment.detectStart);
							const to = Math.min(end, segment.detectStart + segment.detectLength);
							if (from >= to) continue;
							inputLength += to - from;
							if (inputLength > 20000) return null;
							if (run === null) { run = { start: from, end: to, text: "" }; runs.push(run); }
							run.end = to;
							run.text += layout.detectText.slice(from, to);
						}
						return { runs, end };
					});
					if (plan === null) return false;
					const edits = [];
					let outputLength = 0;
					let delta = 0;
					for (const run of plan.runs) {
						const output = transform(run.text);
						if (typeof output !== "string" || (outputLength += output.length) > 80000 || /[\\r\\uE100-\\uE11D\\uFFFC]/u.test(output)) return false;
						const before = run.text.split("\\n"), after = output.split("\\n");
						if (before.length !== after.length) return false;
						let offset = run.start;
						for (let i = 0; i < before.length; i += 1) {
							if (before[i] !== after[i]) edits.push({ start: offset, end: offset + before[i].length, text: after[i] });
							offset += before[i].length + 1;
						}
						delta += output.length - run.text.length;
					}
					if (!allowed() || !idle() || this.editor.getEditorState() !== state || this.editor.isComposing() || !this.editor.isEditable()) return false;
					if (edits.length === 0) return true;
					const editor = this.editor, onError = editor._onError;
					let attempted, fault = false;
					// Pinned Lexical calls _onError BEFORE discarding a failed pending
					// state. The owner's throwing handler would abort that rollback.
					// Let Lexical finish its own recovery; never replace state/history
					// ourselves (listeners may have made newer edits).
					editor._onError = () => { fault = true; };
					try {
						this.applyEdit(() => {
							attempted = editor._pendingEditorState;
							for (let i = edits.length - 1; i >= 0; i -= 1) {
								if (!$replaceDetectSpanWithText(edits[i], edits[i].text)) throw new Error("Validated transform range did not map");
							}
							const caret = plan.end + delta;
							selectSpan($composerLayout(), { start: caret, end: caret });
						}, Co);
					} catch (_error) {
						// Update/mutation listeners run AFTER commit and may throw.
						// Commit may be known, but notification/undo bookkeeping is not.
						fault = true;
					} finally {
						editor._onError = onError;
					}
					// bi marks the attempted state read-only after reconciliation,
					// before notifying listeners. It stays proof of commit even if
					// a listener subsequently installs a newer editor state.
					if (attempted?._readOnly) return fault ? null : true;
					if (editor.getEditorState() === state && editor._pendingEditorState === null) return false;
					return null;
				} catch (_error) {
					return false;
				}
			}
`;

function insertExactlyOnce(source, anchor, addition) {
  if (source.split(anchor).length !== 2) throw new Error(`Owner anchor missing or ambiguous: ${anchor.trim()}`);
  return source.replace(anchor, addition + anchor);
}

/** Pure generator: never reads/writes installed files or deploys anything. */
export function patchOwnerSource(source) {
  if (typeof source !== 'string') throw new TypeError('Expected captured UTF-8 source');
  const hash = createHash('sha256').update(source, 'utf8').digest('hex');
  if (hash !== INPUT_SHA256) throw new Error(`Unsupported owner source SHA-256: ${hash}`);
  return insertExactlyOnce(insertExactlyOnce(source, API_ANCHOR, action), RUNTIME_ANCHOR, runtime);
}
