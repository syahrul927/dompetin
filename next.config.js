/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

import withPWA from "next-pwa";

/** @type {import("next").NextConfig} */
const config = {};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "dompetin-v1-offline",
        expiration: {
          maxEntries: 200,
        },
      },
    },
    {
      urlPattern: /\/api\/trpc\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "dompetin-v1-api",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 300, // 5 minutes
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "dompetin-v1-images",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 2592000, // 30 days
        },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "dompetin-v1-static",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 2592000, // 30 days
        },
      },
    },
  ],
});

export default pwaConfig(config);
