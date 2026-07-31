import { getCollection } from "astro:content";
const archives = (await getCollection("archives")).sort((a, b) => {
  return (
    new Date(b.data.date).getTime() -
    new Date(a.data.date).getTime()
  );
});

export { archives };