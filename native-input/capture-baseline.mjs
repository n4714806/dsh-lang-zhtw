// Read installed bytes; write only a new workspace baseline. Never repack/install.
import {extractFile} from '@electron/asar';import {mkdirSync,writeFileSync,readFileSync,existsSync,createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import {resolve,dirname,normalize} from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('./',import.meta.url)),archive=process.argv[2];
if(!archive?.endsWith('app.asar'))throw Error('Pass installed app.asar as read-only input.');
const known=JSON.parse(readFileSync(resolve(root,'known-source.json'),'utf8'));
const names=['package.json','lib/main.js','lib/preload-app.cjs','dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js'];
assert.deepEqual(Object.keys(known.files),names);
const data=Object.fromEntries(names.map(name=>[name,extractFile(archive,normalize(name))]));
for(const name of names)assert.equal(createHash('sha256').update(data[name]).digest('hex'),known.files[name],'Unsupported source: '+name);
const metadata=JSON.parse(data['package.json'].toString('utf8'));assert.equal(metadata.version,known.version);assert.equal(metadata.dshBuildCommit,known.commit);
const digest=createHash('sha256');for await(const bytes of createReadStream(archive))digest.update(bytes);
const base=resolve(root,'baseline');mkdirSync(base);
for(const name of names){mkdirSync(dirname(resolve(base,name)),{recursive:true});writeFileSync(resolve(base,name),data[name],{flag:'wx'});}
writeFileSync(resolve(root,'installed-asar-before.sha256'),digest.digest('hex')+'\n',{flag:'wx'});
const research=resolve(root,'../research/ui-conversation-client.js');mkdirSync(dirname(research),{recursive:true});
if(existsSync(research))assert.equal(createHash('sha256').update(readFileSync(research)).digest('hex'),known.files[names[3]]);else writeFileSync(research,data[names[3]],{flag:'wx'});
console.log('PASS: pinned four source files captured read-only; workspace-only baseline and whole-ASAR checksum recorded.');
