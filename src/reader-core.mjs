// Reader-only conversion. Never accepts or mutates application state.
export const MAX_READER_LENGTH = 20000;
export const PROTECTED_SELECTION = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],pre,code,kbd,samp,script,style,[data-private],[data-sensitive],a[href]';
export function captureSelection(selection) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return {error:'empty'};
  const parent = node => node?.nodeType === 1 ? node : node?.parentElement;
  if (parent(selection.anchorNode)?.closest(PROTECTED_SELECTION) || parent(selection.focusNode)?.closest(PROTECTED_SELECTION)) return {error:'protected'};
  const range = selection.getRangeAt(0), root = range.commonAncestorContainer;
  if (!root) return {error:'readError'};
  // Read only intersecting source nodes. Never clone DOM: cloning custom elements
  // or resource elements can have side effects even without attaching the clone.
  const stack = [root];let visited = 0, queued = 1;
  while (stack.length) {
    if (++visited > 5000) return {error:'tooComplex'};
    const node = stack.pop();
    if (node !== root && !range.intersectsNode(node)) continue;
    if (node.nodeType === 1 && node.matches(PROTECTED_SELECTION)) return {error:'protected'};
    for (let child = node.lastChild; child; child = child.previousSibling) {
      if (++queued > 5000) return {error:'tooComplex'};
      stack.push(child);
    }
  }
  const text = selection.toString();
  if (!text.trim()) return {error:'empty'};
  if (text.length > MAX_READER_LENGTH) return {error:'tooLong'};
  return {text};
}

// Marked technical content and recognisable bare addresses stay byte-for-byte intact.
// Unmarked identifiers cannot be inferred perfectly: original view is always available.
const technical = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|\$?\{[\w.:-]+\}|(?:https?|file|dsh-resource):\/\/[^\s<>"'）)]+|[A-Za-z]:[\\/][^\s<>"'）)]+|\\\\[^\s<>"'）)]+|(?<![\w])(?:\.{0,2}\/)(?:[^\s<>"'）),，。]+\/)*[^\s<>"'）),，。]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|%[sdif]/gu;
const commandLine = /^\s*(?:\$\s|PS\s+[^>]*>|(?:npm|pnpm|yarn|node|python|python3|git|curl|pwsh|powershell|bash|cmd|ssh|sudo)\s)/i;
export function convertProse(text, converter) {
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$))/g).map((part,index) => index % 2 ? part : part.split(/(\r\n|\n|\r)/).map(line => {
    if (commandLine.test(line)) return line;
    let output='',offset=0;
    for (const match of line.matchAll(technical)) {
      output+=converter(line.slice(offset,match.index))+match[0];offset=match.index+match[0].length;
    }
    return output+converter(line.slice(offset));
  }).join('')).join('');
}
export function readerView(original,mode,converter) {
  return mode==='original' ? original : convertProse(original,converter);
}
