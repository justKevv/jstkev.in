// @ts-check
import { defineConfig, fontProviders, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';

import react from '@astrojs/react';

import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
export default defineConfig({
  site: "https://jstkev.in",
  output: 'static',
  trailingSlash: 'never',
  adapter: cloudflare(),
  env: {
    schema: {
      GITHUB_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  image: {
    domains: ['api.iconify.design', 'media.jstkev.in'],
  },
  vite: {
    plugins: [tailwindcss()]
  },
  fonts: [{
    provider: fontProviders.local(),
    name: "YRDZST",
    cssVariable: "--font-yrdzst",
    options: {
      variants: [{
        src: ['./src/assets/fonts/YRDZST.woff2'],
        weight: 'normal',
        style: 'normal',
      }]
    },
  }, {
    provider: fontProviders.local(),
    name: "Cause",
    cssVariable: "--font-cause",
    options: {
      variants: [{
        src: ['./src/assets/fonts/cause/Cause[wght].woff2'],
        weight: '100 900',
        style: 'normal',
      }]
    },
  }],
  integrations: [mdx(), sitemap(), react()],
});
