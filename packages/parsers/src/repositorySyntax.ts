import { parse } from "@babel/parser";

/** Syntax observations only: neither executes source nor claims runtime reachability. */
export interface RepositorySyntax {
  imports: { module: string; imported: string; local: string; line: number; typeOnly: boolean }[];
  declarations: {
    name: string;
    kind: "function" | "class" | "model";
    line: number;
    endLine: number;
    exportedAs: string[];
    fields: string[];
    calls: { target: string; line: number; column: number; awaited: boolean; shadowed: boolean }[];
  }[];
  routes: {
    receiver: string;
    method: string;
    path: string;
    line: number;
    handler: string | null;
    framework: string;
  }[];
  unstableBindings: string[];
  diagnostics: string[];
}

// The Babel node union includes language-specific shapes. Keep it at this
// parsing boundary; the public result is a small serializable typed contract.
type Node = any;
function walk(node: Node, visit: (node: Node, parent?: Node) => boolean | void, parent?: Node) {
  if (!node || typeof node !== "object" || typeof node.type !== "string") return;
  if (visit(node, parent) === false) return;
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "comments", "leadingComments", "trailingComments", "tokens"].includes(key))
      continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value === "object") walk(value, visit, node);
  }
}
const line = (node: Node) => node?.loc?.start.line || 1;
function nameOf(node: Node): string | null {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "ThisExpression") return "this";
  if (node?.type === "MemberExpression" && !node.computed) {
    const object = nameOf(node.object);
    return object && node.property?.name ? `${object}.${node.property.name}` : null;
  }
  return null;
}
function bindingNames(node: Node): string[] {
  if (!node) return [];
  if (node.type === "Identifier") return [node.name];
  if (node.type === "AssignmentPattern") return bindingNames(node.left);
  if (node.type === "RestElement") return bindingNames(node.argument);
  if (node.type === "ArrayPattern") return node.elements.flatMap(bindingNames);
  if (node.type === "ObjectPattern")
    return node.properties.flatMap((p: Node) => bindingNames(p.value || p.argument));
  return [];
}

export function inspectRepositorySyntax(path: string, source: string): RepositorySyntax {
  const result: RepositorySyntax = {
    imports: [],
    declarations: [],
    routes: [],
    unstableBindings: [],
    diagnostics: [],
  };
  let ast: Node;
  try {
    ast = parse(source, {
      sourceType: "unambiguous",
      plugins: [
        /\.[cm]?tsx?$/.test(path) ? "typescript" : "jsx",
        ...(/\.tsx$/.test(path) ? ["jsx" as const] : []),
      ],
    });
  } catch (error) {
    result.diagnostics.push(
      `Syntax could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }
  const frameworkImports = new Map<string, string>();
  const receivers = new Map<string, string>();
  const exportAliases = new Map<string, string[]>();
  const functions: {
    node: Node;
    name: string;
    kind: "function" | "class" | "model";
    exports: string[];
  }[] = [];
  for (const statement of ast.program.body) {
    if (statement.type === "ImportDeclaration") {
      if (!statement.specifiers.length)
        result.imports.push({
          module: statement.source.value,
          imported: "side effect",
          local: "",
          line: line(statement),
          typeOnly: false,
        });
      for (const specifier of statement.specifiers) {
        const imported =
          specifier.imported?.name ||
          specifier.imported?.value ||
          (specifier.type === "ImportDefaultSpecifier" ? "default" : "*");
        result.imports.push({
          module: statement.source.value,
          local: specifier.local.name,
          imported,
          line: line(statement),
          typeOnly: statement.importKind === "type" || specifier.importKind === "type",
        });
        const framework = statement.source.value;
        if (
          (framework === "hono" && imported === "Hono") ||
          (framework === "express" && ["default", "Router"].includes(imported)) ||
          (framework === "fastify" && ["default", "fastify"].includes(imported)) ||
          (framework === "@koa/router" && imported === "default")
        )
          frameworkImports.set(specifier.local.name, framework);
      }
    }
    if (
      ["ExportAllDeclaration", "ExportNamedDeclaration"].includes(statement.type) &&
      statement.source
    )
      result.imports.push({
        module: statement.source.value,
        imported: "re-export",
        local: "",
        line: line(statement),
        typeOnly: statement.exportKind === "type",
      });
    if (statement.type === "ExportNamedDeclaration" && !statement.source) {
      for (const specifier of statement.specifiers) {
        const aliases = exportAliases.get(specifier.local?.name) || [];
        aliases.push(specifier.exported?.name || specifier.exported?.value);
        exportAliases.set(specifier.local?.name, aliases);
      }
    }
    const node = statement.declaration || statement;
    const exported = statement.type.startsWith("Export");
    const exportsFor = (name: string) =>
      exported ? [statement.type === "ExportDefaultDeclaration" ? "default" : name] : [];
    if (
      [
        "FunctionDeclaration",
        "ClassDeclaration",
        "TSInterfaceDeclaration",
        "TSTypeAliasDeclaration",
      ].includes(node.type)
    ) {
      const name = node.id?.name || "default";
      functions.push({
        node,
        name,
        kind:
          node.type === "ClassDeclaration"
            ? "class"
            : node.type.startsWith("TS")
              ? "model"
              : "function",
        exports: exportsFor(name),
      });
    }
    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        if (declaration.id.type !== "Identifier") continue;
        if (["ArrowFunctionExpression", "FunctionExpression"].includes(declaration.init?.type))
          functions.push({
            node: declaration.init,
            name: declaration.id.name,
            kind: "function",
            exports: exportsFor(declaration.id.name),
          });
        const init = declaration.init;
        if (node.kind === "const" && ["NewExpression", "CallExpression"].includes(init?.type)) {
          const factory = nameOf(init.callee)?.split(".")[0];
          if (factory && frameworkImports.has(factory))
            receivers.set(declaration.id.name, frameworkImports.get(factory)!);
        }
      }
    }
  }
  const unstable = new Set<string>();
  walk(ast.program, (node) => {
    if (node.type === "AssignmentExpression")
      bindingNames(node.left).forEach((name) => unstable.add(name));
    if (node.type === "UpdateExpression")
      bindingNames(node.argument).forEach((name) => unstable.add(name));
  });
  result.unstableBindings = [...unstable].sort();
  for (const name of unstable) receivers.delete(name);
  for (const item of [...functions]) {
    if (item.kind !== "class") continue;
    for (const method of item.node.body.body) {
      if (method.type !== "ClassMethod" || method.computed || !method.key.name) continue;
      functions.push({
        node: method,
        name: `${item.name}.${method.key.name}`,
        kind: "function",
        exports: [],
      });
    }
  }
  for (const item of functions) {
    const fields =
      item.kind === "model"
        ? (item.node.body?.body || item.node.typeAnnotation?.members || [])
            .map((field: Node) => field.key?.name || field.key?.value)
            .filter(Boolean)
        : [];
    const observed: RepositorySyntax["declarations"][number] = {
      name: item.name,
      kind: item.kind,
      line: line(item.node),
      endLine: item.node.loc?.end.line || line(item.node),
      exportedAs: [...new Set([...item.exports, ...(exportAliases.get(item.name) || [])])],
      fields,
      calls: [],
    };
    result.declarations.push(observed);
    if (item.kind !== "function") continue;
    const shadowed = new Set<string>((item.node.params || []).flatMap(bindingNames));
    const reassigned = new Set<string>();
    walk(item.node.body, (node) => {
      if (node.type === "VariableDeclarator")
        bindingNames(node.id).forEach((name) => shadowed.add(name));
      if (node.type === "CatchClause")
        bindingNames(node.param).forEach((name) => shadowed.add(name));
      if (node.type === "AssignmentExpression")
        bindingNames(node.left).forEach((name) => reassigned.add(name));
      if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
        if (node.id) shadowed.add(node.id.name);
        return false;
      }
      if (["FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) return false;
    });
    walk(item.node.body, (node, parent) => {
      if (
        [
          "FunctionDeclaration",
          "FunctionExpression",
          "ArrowFunctionExpression",
          "ClassDeclaration",
        ].includes(node.type)
      )
        return false;
      if (node.type === "CallExpression") {
        const target = nameOf(node.callee);
        if (target)
          observed.calls.push({
            target,
            line: line(node),
            column: node.loc?.start.column || 0,
            awaited: parent?.type === "AwaitExpression",
            shadowed:
              shadowed.has(target.split(".")[0]!) ||
              reassigned.has(target.split(".")[0]!) ||
              unstable.has(target.split(".")[0]!),
          });
      }
    });
  }
  // Only recognized framework receivers. A same-spelled .get on an arbitrary
  // object is not an API. Mount prefixes and middleware effects remain unknown.
  const visitRoutes = (
    node: Node,
    scope: Map<string, string>,
    localBindings = new Set<string>(),
  ) => {
    if (!node || typeof node !== "object" || !node.type) return;
    const next = new Map(scope);
    const bindings = new Set(localBindings);
    const hide = (name: string) => {
      next.delete(name);
      bindings.add(name);
    };
    if (/Function|Method/.test(node.type)) {
      for (const param of node.params || []) {
        for (const name of bindingNames(param)) hide(name);
        const type = param.typeAnnotation?.typeAnnotation?.typeName?.name;
        if (param.type === "Identifier" && frameworkImports.has(type))
          next.set(param.name, frameworkImports.get(type)!);
      }
    }
    if (node.type === "CatchClause") bindingNames(node.param).forEach(hide);
    if (node.type === "BlockStatement") {
      for (const statement of node.body) {
        if (statement.type === "VariableDeclaration")
          for (const declaration of statement.declarations)
            bindingNames(declaration.id).forEach(hide);
        if (["FunctionDeclaration", "ClassDeclaration"].includes(statement.type) && statement.id)
          hide(statement.id.name);
      }
    }
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed
    ) {
      const receiver = nameOf(node.callee.object);
      const method = node.callee.property.name;
      if (
        receiver &&
        next.has(receiver) &&
        /^(get|post|put|patch|delete|options|head|all)$/.test(method) &&
        node.arguments[0]?.type === "StringLiteral"
      ) {
        const handler = nameOf(node.arguments.at(-1));
        result.routes.push({
          receiver,
          method: method.toUpperCase(),
          path: node.arguments[0].value,
          line: line(node),
          handler: handler && !bindings.has(handler.split(".")[0]!) ? handler : null,
          framework: next.get(receiver)!,
        });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "comments", "leadingComments", "trailingComments"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((child) => visitRoutes(child, next, bindings));
      else if (value && typeof value === "object") visitRoutes(value, next, bindings);
    }
  };
  visitRoutes(ast.program, receivers);
  return result;
}
