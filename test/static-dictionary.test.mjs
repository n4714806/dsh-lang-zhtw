import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDictionary} from '../tools/static-dictionary.mjs';
const extract = source => extractDictionary(source,'zh','label');
const outer='const base={x:"outer"};';
for (const [name,body] of [
 ['executable shadow','function f(){const base=make(); const zh={...base,label:"会话"};}'],
 ['parameter shadow','function f(base){const zh={...base,label:"会话"};}'],
 ['destructured parameter','function f({base}){const zh={...base,label:"会话"};}'],
 ['destructured local','function f(){const {base}=make(); const zh={...base,label:"会话"};}'],
 ['catch shadow','try{}catch(base){const zh={...base,label:"会话"};}'],
 ['forward lexical binding','function f(){const zh={...base,label:"会话"}; const base={x:"late"};}'],
 ['sibling scope','function a(){const base={x:"sibling"};} function f(){const zh={...base,label:"会话"};}'],
]) test('rejects '+name+' without falling back to outer declaration',()=>{
 assert.throws(()=>extract((name==='sibling scope'?'':outer)+body),/Non-static|unsupported reference/);
});
test('uses the nearest static local instead of an outer object',()=>{
 assert.deepEqual(extract(outer+'function f(){const base={x:"inner"}; const zh={...base,label:"会话"};}'),{x:'inner',label:'会话'});
});
test('resolves a legitimate outer const and function-scoped var',()=>{
 assert.deepEqual(extract(outer+'function f(){const zh={...base,label:"会话"};}'),{x:'outer',label:'会话'});
 assert.deepEqual(extract('function f(){if(true){var base={x:"var"};} const zh={...base,label:"会话"};}'),{x:'var',label:'会话'});
});
