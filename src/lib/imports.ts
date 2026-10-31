/**
 * Multi-language import resolution for the load-bearing factor. Pure: given a file, its source,
 * and a prepared context of the analysed file set, return the analysed files it imports.
 * Only intra-repo edges count; packages from registries are ignored.
 */
import path from "node:path";

export type ImportContext = {
  set: Set<string>;
  /** basename -> every analysed path with that basename (for suffix matches like C includes and Java classes) */
  byBase: Map<string, string[]>;
  /** Go module path from go.mod, if any */
  goModule: string | null;
  /** tsconfig/jsconfig path aliases: prefix (without *) -> target directory prefixes */
  aliases: { prefix: string; targets: string[] }[];
  /** Dart package name from pubspec.yaml */
  dartPackage: string | null;
};

const JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"];
const C_EXTS = [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh"];

export async function buildImportContext(files: string[], readFile: (p: string) => Promise<string | null>): Promise<ImportContext> {
  const set = new Set(files);
  const byBase = new Map<string, string[]>();
  for (const f of files) {
    const b = path.posix.basename(f);
    const list = byBase.get(b);
    if (list) list.push(f);
    else byBase.set(b, [f]);
  }
  let goModule: string | null = null;
  const goMod = await readFile("go.mod");
  if (goMod) goModule = goMod.match(/^module\s+(\S+)/m)?.[1] ?? null;

  const aliases: ImportContext["aliases"] = [];
  for (const cfg of ["tsconfig.json", "jsconfig.json"]) {
    const raw = await readFile(cfg);
    if (!raw) continue;
    try {
      const json = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")) as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
      const baseUrl = (json.compilerOptions?.baseUrl ?? ".").replace(/^\.\/?/, "").replace(/\/+$/, "");
      for (const [k, v] of Object.entries(json.compilerOptions?.paths ?? {})) {
        const prefix = k.replace(/\*$/, "");
        const targets = v.map((t) => path.posix.normalize(path.posix.join(baseUrl, t.replace(/\*$/, ""))).replace(/^\.\/?/, "").replace(/\/+$/, ""));
        aliases.push({ prefix, targets });
      }
    } catch {
      // unreadable tsconfig; fall back to the common "@/" -> "src/" guess below
    }
    break;
  }
  if (!aliases.some((a) => a.prefix === "@/")) aliases.push({ prefix: "@/", targets: ["src", ""] });
  if (!aliases.some((a) => a.prefix === "~/")) aliases.push({ prefix: "~/", targets: ["src", ""] });

  let dartPackage: string | null = null;
  const pubspec = await readFile("pubspec.yaml");
  if (pubspec) dartPackage = pubspec.match(/^name:\s*(\S+)/m)?.[1] ?? null;

  return { set, byBase, goModule, aliases, dartPackage };
}

function first(ctx: ImportContext, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const n = path.posix.normalize(c).replace(/^\.\//, "");
    if (ctx.set.has(n)) return n;
  }
  return undefined;
}

/** Files whose path ends with the given relative suffix, e.g. "a/b/C.java". */
function bySuffix(ctx: ImportContext, suffix: string): string[] {
  const list = ctx.byBase.get(path.posix.basename(suffix)) ?? [];
  const s = suffix.startsWith("/") ? suffix : "/" + suffix;
  return list.filter((p) => ("/" + p).endsWith(s));
}

function jsCandidates(base: string): string[] {
  return [base, ...JS_EXTS.map((e) => base + e), ...JS_EXTS.map((e) => base + "/index" + e)];
}

export function resolveImports(file: string, src: string, ctx: ImportContext): string[] {
  const out = new Set<string>();
  const add = (p: string | undefined) => {
    if (p && p !== file) out.add(p);
  };
  const dir = path.posix.dirname(file);
  const ext = path.extname(file).toLowerCase();

  if (JS_EXTS.includes(ext)) {
    const re = /(?:from\s+|require\(\s*|import\(\s*|import\s+)['"]([^'"\n]+)['"]/g;
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (spec.startsWith(".")) {
        add(first(ctx, jsCandidates(path.posix.join(dir, spec))));
        continue;
      }
      for (const a of ctx.aliases) {
        if (!spec.startsWith(a.prefix)) continue;
        const rest = spec.slice(a.prefix.length);
        for (const t of a.targets) {
          const hit = first(ctx, jsCandidates(path.posix.join(t, rest)));
          if (hit) {
            add(hit);
            break;
          }
        }
      }
    }
  } else if (ext === ".py") {
    const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
    for (const m of src.matchAll(re)) {
      const mod = m[1] ?? m[2];
      let base: string;
      if (mod.startsWith(".")) {
        const ups = (mod.match(/^\.+/)?.[0].length ?? 1) - 1;
        const rest = mod.slice(ups + 1).replace(/\./g, "/");
        let d = dir;
        for (let i = 0; i < ups; i++) d = path.posix.dirname(d);
        base = path.posix.join(d, rest);
      } else {
        base = mod.replace(/\./g, "/");
      }
      add(first(ctx, [base + ".py", base + "/__init__.py", "src/" + base + ".py", "src/" + base + "/__init__.py"]));
    }
  } else if (ext === ".go") {
    if (ctx.goModule) {
      const block = src.match(/import\s*\(([\s\S]*?)\)/g)?.join("\n") ?? "";
      const singles = [...src.matchAll(/^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm)].map((m) => m[1]);
      const inBlock = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of [...singles, ...inBlock]) {
        if (!spec.startsWith(ctx.goModule + "/") && spec !== ctx.goModule) continue;
        const pkgDir = spec === ctx.goModule ? "" : spec.slice(ctx.goModule.length + 1);
        for (const p of ctx.set) {
          if (p.endsWith(".go") && !p.endsWith("_test.go") && path.posix.dirname(p) === (pkgDir || ".")) add(p);
        }
      }
    }
  } else if (ext === ".java" || ext === ".kt" || ext === ".kts" || ext === ".scala") {
    for (const m of src.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;?/gm)) {
      const parts = m[1].split(".");
      // try the longest prefix that is a class file: a.b.C.D -> a/b/C.java, a/b/C/D.java ...
      for (let n = parts.length; n >= 2; n--) {
        const rel = parts.slice(0, n).join("/");
        const hits = [".java", ".kt", ".scala"].flatMap((e) => bySuffix(ctx, rel + e));
        if (hits.length) {
          hits.forEach(add);
          break;
        }
      }
    }
  } else if (ext === ".rs") {
    for (const m of src.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm)) {
      const name = m[1];
      const base = path.posix.basename(file);
      const here = base === "mod.rs" || base === "lib.rs" || base === "main.rs" ? dir : path.posix.join(dir, base.replace(/\.rs$/, ""));
      add(first(ctx, [path.posix.join(here, name + ".rs"), path.posix.join(here, name, "mod.rs")]));
    }
    for (const m of src.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+crate::([\w:]+)/gm)) {
      const segs = m[1].split("::").filter((x) => x !== "self" && x !== "super");
      for (let n = segs.length; n >= 1; n--) {
        const rel = segs.slice(0, n).join("/");
        const hit = first(ctx, ["src/" + rel + ".rs", "src/" + rel + "/mod.rs"]);
        if (hit) {
          add(hit);
          break;
        }
      }
    }
  } else if (ext === ".rb") {
    for (const m of src.matchAll(/^\s*require_relative\s+['"]([^'"]+)['"]/gm)) add(first(ctx, [path.posix.join(dir, m[1] + ".rb"), path.posix.join(dir, m[1])]));
    for (const m of src.matchAll(/^\s*require\s+['"]([^'"]+)['"]/gm)) add(first(ctx, ["lib/" + m[1] + ".rb", m[1] + ".rb"]));
  } else if (C_EXTS.includes(ext)) {
    for (const m of src.matchAll(/^\s*#\s*include\s+"([^"]+)"/gm)) {
      const rel = m[1];
      const hit = first(ctx, [path.posix.join(dir, rel), rel, "include/" + rel, "src/" + rel]);
      if (hit) add(hit);
      else bySuffix(ctx, rel).slice(0, 1).forEach(add);
    }
  } else if (ext === ".php") {
    for (const m of src.matchAll(/(?:require|include)(?:_once)?\s*\(?\s*(?:__DIR__\s*\.\s*)?['"]([^'"]+\.php)['"]/g)) {
      const rel = m[1].replace(/^\//, "");
      add(first(ctx, [path.posix.join(dir, rel), rel]));
    }
  } else if (ext === ".dart") {
    for (const m of src.matchAll(/^\s*(?:import|part|export)\s+['"]([^'"]+)['"]/gm)) {
      const spec = m[1];
      if (spec.startsWith("package:")) {
        const [pkg, ...rest] = spec.slice(8).split("/");
        if (ctx.dartPackage && pkg === ctx.dartPackage) add(first(ctx, ["lib/" + rest.join("/")]));
      } else if (!spec.startsWith("dart:")) add(first(ctx, [path.posix.join(dir, spec)]));
    }
  }
  return [...out];
}
