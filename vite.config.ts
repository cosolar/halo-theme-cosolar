import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [haloThemePlugin()],
  lint: { options: { typeAware: true, typeCheck: true }, ignorePatterns: [".agents"] },
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    sortPackageJson: true,
    insertFinalNewline: true,
    sortImports: {},
    sortTailwindcss: {},
    ignorePatterns: [".agents"],
  },
  staged: {
    "*": ["vp check"],
  },
});
