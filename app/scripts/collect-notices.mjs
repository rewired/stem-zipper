import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NODE_MODULES = path.join(ROOT, "node_modules");
const OUT_DIR = path.join(ROOT, "third_party_notices");
const NOTICE_NAMES = ["NOTICE", "NOTICE.txt", "NOTICE.md", "NOTICE.markdown"];

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip big folders we don't need to traverse deeply
      if (e.name === ".cache") continue;
      yield* walk(fp);
    } else {
      yield fp;
    }
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  let copied = 0;
  try {
    await fs.access(NODE_MODULES);
  } catch {
    console.warn("node_modules not found — skipping NOTICE collection");
    return;
  }
  for await (const file of walk(NODE_MODULES)) {
    const base = path.basename(file);
    if (!NOTICE_NAMES.includes(base)) continue;
    const rel = path.relative(NODE_MODULES, file); // e.g. "<pkg>/NOTICE"
    const safeRel = rel.replace(/\\/g, "/");
    const outPath = path.join(OUT_DIR, safeRel);
    await ensureDir(path.dirname(outPath));
    await fs.copyFile(file, outPath);
    copied++;
  }
  console.log(`Collected ${copied} NOTICE file(s) into`, OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
