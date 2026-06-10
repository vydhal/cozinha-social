import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => {
  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");
  const { default: react } = await import("@vitejs/plugin-react");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [
    tanstackStart({
      server: { entry: "server" },
    }),
    tailwindcss(),
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
