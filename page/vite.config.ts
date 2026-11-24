import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import { prerender } from "./scripts/prerender.ts";

// Dev server ports that must never be used (other projects own them).
const FORBIDDEN_PORTS: readonly number[] = [4191, 4291];

/** The CSP meta blocks Vite's injected dev styles, so it is removed in dev only. */
function devWithoutCsp(): Plugin {
  return {
    name: "ws-dev-without-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/g, "");
    },
  };
}

/** Builds src/boot/boot.ts into a tiny classic script, boot.js, served in dev and emitted in the build. */
function bootScript(): Plugin {
  const compile = (): string =>
    transformSync(readFileSync("src/boot/boot.ts", "utf8"), { loader: "ts", format: "iife", minify: true, target: "es2019" }).code;
  return {
    name: "ws-boot-script",
    configureServer(server) {
      server.middlewares.use("/boot.js", (_req, res) => {
        res.setHeader("Content-Type", "text/javascript");
        res.end(compile());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "boot.js", source: compile() });
    },
  };
}

export default defineConfig(({ command }) => {
  const port = Number(process.env["WS_PORT"] ?? 5183);
  if (FORBIDDEN_PORTS.includes(port)) {
    throw new Error(`Port ${port} is reserved for another project.`);
  }
  return {
    // Relative base: works from any GitHub Pages sub-path.
    base: "./",
    plugins: [bootScript(), prerender(), ...(command === "serve" ? [devWithoutCsp()] : [])],
    server: { port, strictPort: true, host: "127.0.0.1" },
    build: {
      target: "es2022",
      outDir: "dist",
      assetsInlineLimit: 0,
      sourcemap: false,
    },
  };
});
