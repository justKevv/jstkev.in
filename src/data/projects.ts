import { getCollection, type CollectionEntry } from "astro:content";
const projects = await getCollection("projects")
const sorted = projects.sort((first, second) => first.data.order - second.data.order);

const featured = sorted.filter(p => p.data.featured);
const category = Object.groupBy(sorted, (project) => project.data.category);
type Project = CollectionEntry<"projects">;

export { featured, category, type Project };
