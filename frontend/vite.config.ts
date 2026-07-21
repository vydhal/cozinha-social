import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => {
  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");
  const { default: react } = await import("@vitejs/plugin-react");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [
    tanstackStart({
      server: { entry: "server" },
    }),
    // O Tailwind roda via PostCSS (postcss.config.mjs), e não pelo plugin do
    // Vite, para que o downlevel de cascade layers/oklch seja aplicado na
    // saída gerada — ver comentários em postcss.config.mjs.
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    react(),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        preset: "node-server",
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/client",
        },
      }),
    );
  }

  return { plugins };
});
