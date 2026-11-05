// Explicit offline import from an already obtained plugin artifact. No package installation.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractDictionary} from './static-dictionary.mjs';
const [name,input,version]=process.argv.slice(2);
const root=new URL('../',import.meta.url);
const manifestPath=new URL('dictionaries/sources.json',root);
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const entry=manifest.find(x=>x.package===name);
if(!entry||!input||!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version??''))throw Error('Usage: node tools/refresh-plugin-source.mjs <dsh-mnemon|dsh-context> <client.js> <version>; review namespace/binding before importing a new version.');
const source=readFileSync(input,'utf8');
const dictionary=extractDictionary(source,entry.binding,entry.requiredKey);
entry.version=version;entry.sha256=createHash('sha256').update(source).digest('hex');entry.keys=Object.keys(dictionary).length;
writeFileSync(new URL('dictionaries/source/'+name+'.zh.json',root),JSON.stringify(dictionary,null,2)+'\n');
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Updated workspace snapshot only: '+name+' '+version+' ('+entry.keys+' keys). Review diff and license, then npm run build && npm test.');
