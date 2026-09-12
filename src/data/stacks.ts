/**
 * Single source of truth for stack metadata.
 * To add a new tech, add ONE entry here.
 */

export interface StackMeta {
  url: string;
  icon: string;
}

export const stacks: Record<string, StackMeta> = {
  astro: { url: "https://astro.build", icon: "devicon:astro" },
  typescript: { url: "https://www.typescriptlang.org/", icon: "devicon:typescript" },
  gsap: { url: "https://gsap.com/", icon: "simple-icons:gsap" },
  tailwindcss: { url: "https://tailwindcss.com", icon: "devicon:tailwindcss" },
  "next.js": { url: "https://nextjs.org/", icon: "devicon:nextjs" },
  "sanity.io": { url: "https://www.sanity.io/", icon: "devicon:sanity" },
  python: { url: "https://www.python.org", icon: "devicon:python" },
  arduino: { url: "https://www.arduino.cc", icon: "devicon:arduino" },
  flask: { url: "https://flask.palletsprojects.com", icon: "devicon:flask" },
  streamlit: { url: "https://streamlit.io", icon: "devicon:streamlit" },
  yolo: { url: "https://docs.ultralytics.com/", icon: "simple-icons:yolo" },
  gemini: { url: "https://aistudio.google.com/", icon: "vscode-icons:file-type-gemini" },
  php: { url: "https://www.php.net", icon: "devicon:php" },
  laravel: { url: "https://laravel.com", icon: "devicon:laravel" },
  alpinejs: { url: "https://alpinejs.dev", icon: "devicon:alpinejs" },
  prelineui: { url: "https://preline.co", icon: "gg:ui-kit" },
  mysql: { url: "https://www.mysql.com", icon: "devicon:mysql" },
  imagekit: { url: "https://imagekit.io", icon: "material-symbols:image" },
  slim: { url: "https://www.slimframework.com", icon: "logos:slim" },
  sqlserver: { url: "https://www.microsoft.com/en-us/sql-server", icon: "devicon:microsoftsqlserver" },
  golang: { url: "https://golang.org", icon: "devicon:go" },
  "flow launcher": { url: "https://www.flowlauncher.com", icon: "fluent:desktop-flow-24-filled" },
  "notion api": { url: "https://developers.notion.com", icon: "devicon:notion" },
  fastapi: { url: "https://fastapi.tiangolo.com", icon: "devicon:fastapi" },
  docker: { url: "https://www.docker.com", icon: "devicon:docker" },
  huggingspaces: { url: "https://huggingface.co/spaces", icon: "devicon:huggingface" },
  fastcron: { url: "https://fastcron.com", icon: "eos-icons:cronjob" },
  nestjs: { url: "https://nestjs.com", icon: "devicon:nestjs" },
  "socket.io": { url: "https://socket.io", icon: "devicon:socketio" },
  supabase: { url: "https://supabase.com", icon: "devicon:supabase" },
  langchain: { url: "https://langchain-ai.github.io", icon: "devicon:langchain" },
  react: { url: "https://react.dev", icon: "devicon:react" },
  vite: { url: "https://vite.dev", icon: "logos:vite-icon" },
  mongodb: { url: "https://www.mongodb.com/", icon: "devicon:mongodb" },
  hono: { url: "https://hono.dev/", icon: "logos:hono" },
  bun: { url: "https://bun.sh/", icon: "devicon:bun" },
  "cloudflare kv": { url: "https://developers.cloudflare.com/kv/", icon: "devicon:cloudflare" },
  threejs: { url: "https://threejs.org/", icon: "devicon:threejs" },
  "scikit-learn": { url: "https://scikit-learn.org/", icon: "devicon:scikitlearn" },
  pandas: { url: "https://pandas.pydata.org/", icon: "devicon:pandas" },
  "tf-idf": { url: "https://scikit-learn.org/", icon: "devicon:python" },
  numpy: { url: "https://numpy.org/", icon: "devicon:numpy" },
};

export type StackKey = keyof typeof stacks;

export const FALLBACK_STACK_ICON = "mdi:code-braces";

function normalizeKey(name: string): string {
  return name.toLowerCase().trim();
}

const normalizedStacks: Record<string, StackMeta> = Object.fromEntries(
  Object.entries(stacks).map(([key, meta]) => [normalizeKey(key), meta]),
);

export interface ResolvedStack extends StackMeta {
  /** Original display label passed in (preserved for rendering). */
  label: string;
  /** True when the key was not found and fallback icon/url was used. */
  isFallback: boolean;
}

export function getStack(name: string): ResolvedStack {
  const hit = normalizedStacks[normalizeKey(name)];
  if (hit) return { ...hit, label: name, isFallback: false };
  return { url: "", icon: FALLBACK_STACK_ICON, label: name, isFallback: true };
}

/** Returns undefined for unknown tech so callers can render a plain pill instead of a broken link. */
export function getStackUrl(name: string): string | undefined {
  const { url, isFallback } = getStack(name);
  return isFallback ? undefined : url;
}

export function getStackIcon(name: string): string {
  return getStack(name).icon;
}
