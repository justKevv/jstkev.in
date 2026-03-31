export default function generateSlug(title: string): string {
  return title
    .trim()
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
