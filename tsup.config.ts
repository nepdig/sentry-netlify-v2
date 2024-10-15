import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/index.mts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
