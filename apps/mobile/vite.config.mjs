import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mobileAssets } from "./scripts/mobile-assets.mjs";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = path.resolve(appRoot, "../..");

export default defineConfig({
  root: appRoot,
  // The website public directory also contains store/media assets. Bundle only
  // the game assets selected below, with no remote website dependency.
  publicDir: false,
  plugins: [
    {
      name: "shared-game-global-style",
      enforce: "pre",
      transform(code, id) {
        if (id.replaceAll("\\", "/").endsWith("/simulator/Simulator.jsx")) {
          // Next compiles this global stylesheet marker. Plain React needs the
          // same global style element without styled-jsx's compiler attributes.
          return code.replace("<style jsx global>", "<style>");
        }
      },
    },
    react(), mobileAssets(repositoryRoot),
  ],
  resolve: {
    alias: {
      "@": path.join(repositoryRoot, "src"),
      "next/image": path.join(appRoot, "src/adapters/Image.jsx"),
      "next/link": path.join(appRoot, "src/adapters/Link.jsx"),
      "next/navigation": path.join(appRoot, "src/adapters/navigation.mjs"),
    },
    dedupe: ["react", "react-dom"],
  },
  css: { postcss: { plugins: [tailwind()] } },
  server: { fs: { allow: [repositoryRoot] } },
  build: { target: "safari16.4", sourcemap: false, reportCompressedSize: false, chunkSizeWarningLimit: 1800 },
});
