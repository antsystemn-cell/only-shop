import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.png", "pwa-icon-192.png", "pwa-icon-384.png", "pwa-icon-512.png", "offline.html"],
      manifest: {
        name: "Only.mn – Хятад, Америкаас захиалга",
        short_name: "Only",
        description: "Cross-border shopping from Poizon, Taobao and more.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f5f6f8",
        theme_color: "#0B3A8F",
        categories: ["shopping", "lifestyle"],
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/pwa-icon-384.png", sizes: "384x384", type: "image/png", purpose: "any maskable" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        shortcuts: [
          { name: "Poizon", short_name: "Poizon", url: "/ot/provider/poizon", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
          { name: "Taobao", short_name: "Taobao", url: "/ot/provider/taobao", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
          { name: "Бэлэн бараа", short_name: "Ready", url: "/shop", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/admin/],
        runtimeCaching: [
          // Static assets - Cache First
          {
            urlPattern: /\.(?:js|css|woff2?)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          // Images - Stale While Revalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
          // External images (product thumbnails) - Stale While Revalidate
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|webp|avif)(\?.*)?$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "external-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 3 * 24 * 3600 },
            },
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-css",
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 3600 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-woff",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 },
            },
          },
        ],
        // Never cache auth / checkout / cart / account API calls
        // These are handled by navigateFallbackDenylist and not being matched by runtimeCaching
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
