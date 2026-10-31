import assert from "node:assert/strict";
import { test } from "node:test";
import { buildImportContext, resolveImports } from "../src/lib/imports.ts";

const FILES = [
  "src/app.ts", "src/lib/util.ts", "src/lib/index.ts", "src/components/Btn.tsx",
  "pkg/a.py", "pkg/sub/__init__.py", "pkg/sub/b.py",
  "main.go", "internal/store/store.go", "internal/store/store_test.go",
  "src/main/java/com/acme/core/Engine.java", "src/main/java/com/acme/App.java",
  "src/main.rs", "src/net.rs", "src/db/mod.rs", "src/db/pool.rs",
  "lib/thing.rb", "bin/run.rb",
  "src/core.c", "include/core.h", "src/util.h",
  "web/index.php", "web/lib/db.php",
  "lib/widgets/card.dart", "lib/main.dart",
];
const EXTRA: Record<string, string> = {
  "go.mod": "module github.com/acme/app\n\ngo 1.22\n",
  "tsconfig.json": '{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"], "#ui/*": ["src/components/*"] } } }',
  "pubspec.yaml": "name: shop\n",
};
const ctx = await buildImportContext(FILES, async (p) => EXTRA[p] ?? null);
const r = (file: string, src: string) => resolveImports(file, src, ctx).sort();

test("JS/TS: relative, index, and tsconfig aliases", () => {
  assert.deepEqual(r("src/app.ts", `import x from "./lib/util"; import { y } from "./lib"; import B from "@/components/Btn"; import C from "#ui/Btn"; import z from "lodash";`), ["src/components/Btn.tsx", "src/lib/index.ts", "src/lib/util.ts"]);
});

test("Python: relative and dotted imports", () => {
  assert.deepEqual(r("pkg/sub/b.py", "from ..a import f\nfrom . import x\nimport pkg.a\nimport os"), ["pkg/a.py", "pkg/sub/__init__.py"]);
});

test("Go: module-local packages resolve to every non-test file in the package", () => {
  assert.deepEqual(r("main.go", 'import (\n\t"fmt"\n\t"github.com/acme/app/internal/store"\n)'), ["internal/store/store.go"]);
});

test("Java: fully qualified imports resolve by path suffix", () => {
  assert.deepEqual(r("src/main/java/com/acme/App.java", "import com.acme.core.Engine;\nimport java.util.List;"), ["src/main/java/com/acme/core/Engine.java"]);
});

test("Rust: mod declarations and crate paths", () => {
  assert.deepEqual(r("src/main.rs", "mod net;\nmod db;\nuse crate::db::pool::Pool;"), ["src/db/mod.rs", "src/db/pool.rs", "src/net.rs"]);
});

test("Ruby: require_relative and lib requires", () => {
  assert.deepEqual(r("bin/run.rb", 'require_relative "../lib/thing"\nrequire "thing"\nrequire "json"'), ["lib/thing.rb"]);
});

test("C: quoted includes by relative path, include dir, or suffix", () => {
  assert.deepEqual(r("src/core.c", '#include "core.h"\n#include "util.h"\n#include <stdio.h>'), ["include/core.h", "src/util.h"]);
});

test("PHP and Dart", () => {
  assert.deepEqual(r("web/index.php", "require_once __DIR__ . '/lib/db.php';"), ["web/lib/db.php"]);
  assert.deepEqual(r("lib/main.dart", "import 'package:shop/widgets/card.dart';\nimport 'dart:io';"), ["lib/widgets/card.dart"]);
});

test("never imports itself and ignores unknown targets", () => {
  assert.deepEqual(r("src/lib/util.ts", 'import "./util"; import "./missing";'), []);
});
