import {extractFile} from '@electron/asar';import {createReadStream,readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {normalize} from 'node:path';import assert from 'node:assert/strict';
const archive=process.argv[2];if(!archive?.endsWith('app.asar'))throw Error('Pass original ASAR read-only path.');
const known=JSON.parse(readFileSync(new URL('known-source.json',import.meta.url),'utf8'));
for(const [name,expected]of Object.entries(known.files))assert.equal(createHash('sha256').update(extractFile(archive,normalize(name))).digest('hex'),expected,'Installed source unchanged: '+name);
const hash=createHash('sha256');for await(const bytes of createReadStream(archive))hash.update(bytes);
assert.equal(hash.digest('hex'),readFileSync(new URL('installed-asar-before.sha256',import.meta.url),'utf8').trim(),'Complete installed ASAR must remain unchanged');
console.log('PASS: complete installed ASAR and all four pinned source files unchanged.');
