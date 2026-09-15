// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import { unified } from '@astrojs/markdown-remark';

import { remarkReadingTime } from './remark-reading-time.mjs';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: "https://jstkev.in",
  output: 'static',
  trailingSlash: 'never',
  vite: {
    plugins: [tailwindcss()]
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkReadingTime],
    }),
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
  }],
  integrations: [mdx(), sitemap(), react()],
});