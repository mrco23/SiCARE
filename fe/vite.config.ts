import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: "autoUpdate", // Mengupdate service worker otomatis jika ada perubahan
      manifest: {
        name: "SiCARE",
        short_name: "SiCARE",
        description: "SiCARE – Sistem Informasi Konseling Universitas",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone", // Ini yang membuat app berjalan tanpa UI browser (seperti native)
        icons: [
          {
            src: "/android-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/ios-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
