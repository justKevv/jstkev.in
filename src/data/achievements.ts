import type { ImageMetadata } from 'astro';

const images = import.meta.glob('../assets/achievements/*/*.{png,jpg,jpeg,webp}', { eager: false });

function toReadable(str: string) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const resolved = await Promise.all(
  Object.entries(images).map(async ([path, importFn]) => {
    const mod = await (importFn as () => Promise<any>)();
    return [path, mod] as const;
  })
);

const grouped = resolved.reduce((acc, [path, mod]) => {
  const parts = path.split('/');
  const group = toReadable(parts[parts.length - 2]);
  const caption = toReadable(parts[parts.length - 1].replace(/\.(png|jpg|jpeg|webp)$/, ''));
  if (!acc[group]) acc[group] = [];
  acc[group].push({ image: (mod as any).default, caption });
  return acc;
}, {} as Record<string, { image: ImageMetadata, caption: string }[]>);

export const achievements = { grouped };
