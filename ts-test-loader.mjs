import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath, join as joinPath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

function resolveWithExtensions(resolved) {
  const withExt = /\.[^./]+$/.test(resolved);
  const candidates = withExt ? [resolved] : [
    resolved + '.ts',
    resolved + '.tsx',
    joinPath(resolved, 'index.ts'),
    joinPath(resolved, 'index.tsx')
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      return file;
    }
  }
  return null;
}

export function resolve(specifier, context, defaultResolve) {
  let resolvedPath;
  if (specifier.startsWith('@/')) {
    resolvedPath = resolvePath(process.cwd(), specifier.slice(2));
  } else if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    if (specifier.startsWith('file:')) {
      resolvedPath = fileURLToPath(specifier);
    } else {
      resolvedPath = resolvePath(dirname(parentPath), specifier);
    }
  } else {
    return defaultResolve(specifier, context, defaultResolve);
  }

  const file = resolveWithExtensions(resolvedPath);
  if (file) {
    return { url: pathToFileURL(file).href, format: 'module', shortCircuit: true };
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = await readFile(new URL(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2020,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.React
      },
      fileName: fileURLToPath(url)
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return defaultLoad(url, context, defaultLoad);
}