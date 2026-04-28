/* eslint-disable @typescript-eslint/no-var-requires */
/* global module */
module.exports = {
  globDirectory: 'dist',
  globPatterns: [
    '**/*.{html,js,css,json,ico,png,webp,woff,woff2,ttf,svg,jpg,jpeg,webmanifest,txt,webm}',
  ],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.destination === 'document' || request.destination === '',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
      },
    },
    {
      urlPattern: ({ request }) =>
        request.destination === 'script' || request.destination === 'style',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'assets' },
    },
  ],
};
