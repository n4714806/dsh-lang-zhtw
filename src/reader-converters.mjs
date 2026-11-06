import {ConverterFactory, Trie} from 'opencc-js/core';
import fromCn from 'opencc-js/from/cn';
import toTw from 'opencc-js/to/tw';
import fromTw from 'opencc-js/from/tw';
import toCn from 'opencc-js/to/cn';

function lazyConverter(from, to, phrases) {
  let convert;
  return text => {
    if (!convert) {
      // Locale modules contain arrays of dictionary groups. Factory takes
      // those groups as separate arguments, preserving their stage order.
      const chain = ConverterFactory(...from, ...to);
      // OpenCC 1.3's full Converter segments before applying its stages.
      // Preserve those boundaries (including for TW reverse-variant phrases)
      // without importing the full multilingual preset.
      const segmentation = new Trie();
      segmentation.loadDict(phrases);
      convert = input => segmentation.segment(input).map(chain).join('');
    }
    return convert(text);
  };
}

// Each direction initializes independently on first use. Only converters are
// cached: callers always supply the original text, never a prior view's output.
export function createReaderConverters() {
  return {
    traditional: lazyConverter(fromCn, toTw, fromCn[0][0]),
    simplified: lazyConverter(fromTw, toCn, toCn[0][0]),
  };
}
