import test from 'node:test';
import assert from 'node:assert/strict';
import {Converter} from 'opencc-js';
import {Trie} from 'opencc-js/core';
import * as readerConverters from '../src/reader-converters.mjs';
import {convertProse, readerView} from '../src/reader-core.mjs';

const upstream = {
  traditional: Converter({from: 'cn', to: 'tw'}),
  simplified: Converter({from: 'tw', to: 'cn'}),
};
const samples = [
  '', 'ASCII code: const value = 123;\t\r\n',
  '软件发展与头发，用户消息。干净的干部在乾隆年间干活。',
  '后台、台风、台湾、柜台；里面、公里、邻里；钟表、钟情。',
  '鼠标、打印机、数据库、内存、网络：只转换字形，不替换台湾词汇。',
  '軟體與軟件，滑鼠與鼠標；記憶體、內存、資料庫、數據庫。',
  '一目瞭然、不甚了了、瞭望臺、瞭解、了解；乾坤、乾燥、幹部。',
  '著名覆金甌', // Full Converter segmentation differs from a bare Factory here.
  '著作、著名、看著；覆蓋、反覆；頭髮發展；後面皇后。',
  '简繁混合：裏裡里、臺台颱、麵面、祕秘、衞衛、爲為。',
  '𠀀𠮷𡞱𫔭𰻝😀👩🏽‍💻 e\u0301 简体\uFE0F\u200D繁體',
  '\uD800简体\uDC00\0繁體\r\n第二行\t  ',
];

function codepoints(start, end) {
  let text = '';
  for (let cp = start; cp <= end; cp++) text += String.fromCodePoint(cp);
  return text;
}

const codepointSamples = [
  codepoints(0x3400, 0x4dbf),
  codepoints(0x4e00, 0x9fff),
  codepoints(0xf900, 0xfaff),
  codepoints(0x20000, 0x201ff),
];

test('exports only the synchronous converter factory', () => {
  assert.deepEqual(Object.keys(readerConverters), ['createReaderConverters']);
  const converters = readerConverters.createReaderConverters();
  assert.deepEqual(Object.keys(converters), ['traditional', 'simplified']);
  for (const convert of Object.values(converters)) assert.equal(typeof convert, 'function');
});

test('initializes each direction lazily and reuses its converter', t => {
  const load = t.mock.method(Trie.prototype, 'loadDict');
  const converters = readerConverters.createReaderConverters();
  assert.equal(load.mock.callCount(), 0);
  assert.equal(converters.traditional('头发'), '頭髮');
  const traditionalLoads = load.mock.callCount();
  assert.ok(traditionalLoads > 0);
  converters.traditional('用户');
  assert.equal(load.mock.callCount(), traditionalLoads);
  assert.equal(converters.simplified('頭髮'), '头发');
  const bothLoads = load.mock.callCount();
  assert.ok(bothLoads > traditionalLoads);
  converters.simplified('用戶');
  converters.traditional('发展');
  assert.equal(load.mock.callCount(), bothLoads);
});

for (const direction of ['traditional', 'simplified']) {
  test(`${direction} matches upstream full Converter for phrases and codepoints`, () => {
    const convert = readerConverters.createReaderConverters()[direction];
    for (const input of [...samples, ...codepointSamples]) {
      assert.equal(convert(input), upstream[direction](input));
    }
  });

  test(`${direction} is idempotent on representative reader prose`, () => {
    const convert = readerConverters.createReaderConverters()[direction];
    for (const original of ['软件发展与头发，用户消息。', '軟體、資料庫、網路與繁體中文。', 'ASCII 😀 123']) {
      const converted = convert(original);
      assert.equal(convert(converted), converted);
    }
  });

  test(`${direction} preserves technical tokens through convertProse`, () => {
    const convert = readerConverters.createReaderConverters()[direction];
    const tokens = [
      '`简体與繁體變量`', 'https://example.test/简体/繁體',
      'C:\\用户\\繁體.txt', '/tmp/简体/繁體.txt', '../简体/繁體.txt',
      '\\\\server\\用户\\繁體', '${model}', '{filename}', '%s', 'user@example.test',
    ];
    for (const token of tokens) {
      assert.equal(convertProse(`说明說明 ${token} 结束結束`, convert),
        `${convert('说明說明 ')}${token}${convert(' 结束結束')}`);
    }
    for (const block of ['```js\nconst 名称="简体與繁體";\n```', '~~~\n简体與繁體\n~~~', 'git commit -m "简体與繁體"']) {
      assert.equal(convertProse(`说明說明\r\n${block}\r\n结束結束`, convert),
        `${convert('说明說明')}\r\n${block}\r\n${convert('结束結束')}`);
    }
  });
}

test('original view is identity and direction switches use original, not prior output', () => {
  const converters = readerConverters.createReaderConverters();
  const original = '乾';
  const originalView = () => readerView(original, 'original', () => {
    throw new Error('Original view must not invoke a converter');
  });
  assert.equal(originalView(), original);
  assert.equal(converters.simplified(original), '干');
  assert.equal(converters.traditional(original), '乾');
  // A lossy round trip would produce a different result; no cached input/output
  // from the previous call or direction should participate in conversion.
  assert.notEqual(converters.traditional(converters.simplified(original)), converters.traditional(original));
  assert.equal(converters.simplified(original), upstream.simplified(original));
  assert.equal(converters.traditional(original), upstream.traditional(original));
  assert.equal(originalView(), '乾');
  for (const input of samples) assert.equal(readerView(input, 'original', null), input);
});
