/**
 * Depois do `next build`: lista os arquivos de out/ e gera out/sw.js com a lista
 * de precache e uma versão (hash do conteúdo). Mudou qualquer arquivo → versão nova.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const SKIP = [/^sw\.js$/, /\.txt$/, /^404/, /^_not-found/, /\.map$/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join("/"))
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

// "/" no lugar de index.html: alguns servidores redirecionam /index.html → /, e resposta redirecionada não serve para navegação.
const urls = ["/", ...files.filter((f) => !f.endsWith(".html")).map((f) => `/${f}`)];
const template = readFileSync("scripts/sw-template.js", "utf8");
writeFileSync(join(OUT, "sw.js"), template.replace("__VERSION__", version).replace("__FILES__", JSON.stringify(urls)));
console.log(`sw.js: ${urls.length} arquivos, versão ${version}`);
