import {parse} from 'acorn';

// Parse build artifacts as DATA. Never eval, import, or execute plugin code.
export function extractDictionary(source, binding, requiredKey) {
  const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});
  const declarations = [];
  const scopes = new WeakMap();
  const scope = (parent, fn = false) => ({parent, fn, bindings: new Map()});
  function bind(pattern, owner, declaration = null) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      const entries = owner.bindings.get(pattern.name) ?? [];
      entries.push(declaration); owner.bindings.set(pattern.name, entries);
    } else if (pattern.type === 'RestElement') bind(pattern.argument, owner);
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, owner);
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(p => bind(p, owner));
    else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value, owner));
  }
  function walk(node, owner, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Program') owner = scope(null, true);
    if (['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)) {
      if (node.type === 'FunctionDeclaration') bind(node.id, owner);
      owner = scope(owner, true);
      if (node.type === 'FunctionExpression') bind(node.id, owner);
      node.params.forEach(p => bind(p, owner));
    } else if (['BlockStatement','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','CatchClause'].includes(node.type)) {
      owner = scope(owner);
      if (node.type === 'CatchClause') bind(node.param, owner);
    }
    scopes.set(node, owner);
    if (node.type === 'VariableDeclarator') {
      let target = owner;
      if (parent?.kind === 'var') while (!target.fn && target.parent) target = target.parent;
      bind(node.id, target, node.id.type === 'Identifier' ? node : null);
      if (node.id.type === 'Identifier' && node.init) declarations.push(node);
    }
    if (node.type === 'ClassDeclaration') bind(node.id, owner);
    if (node.type === 'ImportDeclaration') node.specifiers.forEach(s => bind(s.local, owner));
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => walk(child, owner, node));
      else if (value && typeof value === 'object') walk(value, owner, node);
    }
  }
  walk(ast, null, null);
  function resolve(node) {
    for (let owner = scopes.get(node); owner; owner = owner.parent) {
      if (!owner.bindings.has(node.name)) continue;
      const entries = owner.bindings.get(node.name);
      // Resolve the actual nearest lexical binding FIRST, including nonliteral,
      // parameter, destructured and forward bindings. Never fall through to an outer name.
      if (entries.length !== 1 || !entries[0]?.init || entries[0].start >= node.start) break;
      return entries[0].init;
    }
    throw Error('Ambiguous or unsupported reference: ' + node.name);
  }
  function decode(node, stack = new Set()) {
    if (!node || stack.has(node)) throw Error('Missing or cyclic dictionary expression');
    const next = new Set(stack).add(node);
    if (node.type === 'Literal' && !node.regex && !node.bigint) return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    if (node.type === 'ArrayExpression') return node.elements.map(x => decode(x, next));
    if (node.type === 'Identifier') return decode(resolve(node), next);
    if (node.type === 'ObjectExpression') {
      const output = Object.create(null);
      for (const p of node.properties) {
        if (p.type === 'SpreadElement') {
          const value = decode(p.argument, next);
          if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('Invalid dictionary spread');
          Object.assign(output, value);
          continue;
        }
        if (p.type !== 'Property' || p.computed || p.kind !== 'init' || p.method) throw Error('Non-data dictionary property');
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        if (typeof key !== 'string' || ['__proto__','constructor','prototype'].includes(key)) throw Error('Unsafe dictionary key');
        output[key] = decode(p.value, next);
      }
      return output;
    }
    throw Error('Non-static dictionary node: ' + node.type);
  }
  const matches = declarations.filter(d => d.id.name === binding && d.init.type === 'ObjectExpression' && (requiredKey === undefined || d.init.properties.some(p => p.type === 'Property' && !p.computed && (p.key.name ?? p.key.value) === requiredKey)));
  const results = matches.map(d => decode(d.init)).filter(d => requiredKey === undefined || Object.hasOwn(d, requiredKey));
  if (results.length !== 1) throw Error(`Expected one dictionary ${binding}; found ${results.length}`);
  return JSON.parse(JSON.stringify(results[0]));
}
