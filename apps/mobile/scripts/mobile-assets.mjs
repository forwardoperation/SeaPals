import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  }));
  return nested.flat();
}

export function mobileAssets(repositoryRoot) {
  const publicRoot = path.join(repositoryRoot, "public");
  let assetFiles;
  async function assets() {
    if (assetFiles) return assetFiles;
    const selected = new Set();
    for (const folder of ["images/cards", "images/icons", "images/backgrounds"]) {
      for (const file of await filesIn(path.join(publicRoot, folder))) {
        if (/\.(?:png|webp|jpe?g|svg)$/i.test(file)) selected.add(file);
      }
    }
    const sourceRoots = ["src/app/simulator", "src/components/rules", "apps/mobile/src"];
    for (const root of sourceRoots) {
      for (const file of await filesIn(path.join(repositoryRoot, root))) {
        if (!/\.(?:jsx?|mjs|css)$/.test(file) || file.includes(".test.")) continue;
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(/["'`(](\/images\/[^"'`\r\n)]+\.(?:png|webp|jpe?g|svg))["'`)]/g)) {
          if (match[1].includes("${")) continue;
          const filename = path.join(publicRoot, match[1].slice(1));
          await stat(filename); // Fail on missing teaching portraits or app art.
          selected.add(filename);
        }
      }
    }
    assetFiles = [...selected].sort();
    return assetFiles;
  }
  return {
    name: "searealm-offline-assets",
    async generateBundle() {
      const manifest = [];
      for (const filename of await assets()) {
        const fileName = path.relative(publicRoot, filename).split(path.sep).join("/");
        const source = await readFile(filename);
        this.emitFile({ type: "asset", fileName, source });
        manifest.push({ path: `/${fileName}`, bytes: source.length });
      }
      this.emitFile({ type: "asset", fileName: "offline-assets.json", source: JSON.stringify(manifest) });
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/images/")) return next();
        try {
          const relative = decodeURIComponent(req.url.split("?")[0]).slice(1);
          const filename = path.resolve(publicRoot, relative);
          if (!(await assets()).includes(filename)) return next();
          const types = { ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
          res.setHeader("Content-Type", types[path.extname(filename)] ?? "application/octet-stream");
          res.end(await readFile(filename));
        } catch (error) { next(error); }
      });
    },
  };
}
