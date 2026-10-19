import type { CollectionEntry } from "astro:content";

type Project = CollectionEntry<"projects">;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "always ongoing" sorts first, undated entries last, otherwise by the end year/month of the range
function dateSortKey(date: string): number {
  if (/ongoing/i.test(date)) return Infinity;
  const year = [...date.matchAll(/\b(\d{4})\b/g)].at(-1)?.[1];
  if (!year) return -Infinity;
  const month = [...date.toLowerCase().matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/g)].at(-1)?.[1];
  return Number(year) * 12 + (month ? MONTHS.indexOf(month) : 0);
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => dateSortKey(b.data.date) - dateSortKey(a.data.date));
}
