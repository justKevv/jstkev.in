import { getCollection, type CollectionEntry } from "astro:content";
const projects = await getCollection("projects")
const sorted = projects.sort((first, second) => second.data.category.localeCompare(first.data.category));
const category = Object.groupBy(sorted, (project) => project.data.category);
type Project = CollectionEntry<"projects">;

export { category, type Project };
