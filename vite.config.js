import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5180,
        proxy: {
            "/gateway-ws": {
                target: "ws://localhost:18789",
                ws: true,
                rewrite: (path) => path.replace(/^\/gateway-ws/, ""),
            },
        },
    },
});
