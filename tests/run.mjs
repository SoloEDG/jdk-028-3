import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { rmSync } from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const entry = path.join(here, process.argv[2] ?? "bus.test.ts");
const outfile = path.join(root, "node_modules", ".bus-test.mjs");
const stubVue = {
  name: "stub-vue",
  setup(build) {
    build.onResolve({ filter: /\.vue$/ }, (args) => ({
      path: args.path,
      namespace: "vue-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "vue-stub" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};
await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  alias: { "@": path.join(root, "src") },
  plugins: [stubVue],
  logLevel: "warning",
});
process.on("exit", () => rmSync(outfile, { force: true }));
await import(outfile).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
