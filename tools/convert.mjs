import * as OpenCC from 'opencc-js';
const convert = OpenCC.Converter({from: 'cn', to: 'twp'});
// Protect interpolation tokens, literal code and addresses before converting UI copy.
// Runtime values never enter this build-time converter.
const protectedPattern = /```[\s\S]*?```|`[^`\n]*`|\$?\{[\w.:-]+\}|https?:\/\/[^\s<>"'）)]+|[A-Za-z]:\\[^\s<>"'）)]+|\b(?:[A-Za-z][\w+.-]*):\/\/[^\s<>"'）)]+|%[sdif]/g;
const polish = [['許可權','權限'],['計劃','計畫'],['插件','外掛'],['會話','對話'],['運行','執行']];
export function protectedTokens(value) { return value.match(protectedPattern) ?? []; }
export function convertText(value) {
  let offset = 0;
  let output = '';
  for (const m of value.matchAll(protectedPattern)) {
    output += polishText(convert(value.slice(offset, m.index))) + m[0];
    offset = m.index + m[0].length;
  }
  return output + polishText(convert(value.slice(offset)));
}
function polishText(value) {for (const [from,to] of polish) value=value.replaceAll(from,to); return value;}
export function convertDictionary(value) {
  if (typeof value === 'string') return convertText(value);
  if (Array.isArray(value)) return value.map(convertDictionary);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,text])=>[key,convertDictionary(text)]));
  return value;
}
