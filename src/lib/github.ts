import { GITHUB_TOKEN } from 'astro:env/server'; // CHANGED: replaces import.meta.env.GITHUB_TOKEN

const USER = 'justKevv';
const EXCLUDED = ['xavierzaidane/resume-ai', 'yourfzz/mgym', 'srikresna/preparation-git'];

const QUERY = `
  query($q: String!, $login: String!) {
    search(query: $q, type: ISSUE, first: 100) {
      issueCount
      nodes {
        ... on PullRequest {
          title
          url
          additions
          deletions
          repository { nameWithOwner }
        }
      }
    }
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;

const LEVELS: Record<string, number> = {
  NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4,
};

export interface PR { repo: string; title: string; url: string; additions: number; deletions: number }
export interface Day { date: string; count: number; level: number }
export interface GithubData { prs: PR[]; days: Day[]; total: number }

async function fetchGithubData(): Promise<GithubData> {
  console.log('[github] token length:', GITHUB_TOKEN?.length ?? 'undefined');
  try {
    const token = (GITHUB_TOKEN ?? '').replace(/[^\x21-\x7E]/g, ''); // keep printable ASCII only
    if (!token) {
      console.error('[github] GITHUB_TOKEN is missing or empty');
      return { prs: [], days: [], total: 0 };
    }

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, // CHANGED
        'Content-Type': 'application/json',
        'User-Agent': 'jstkev.in',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          q: `type:pr is:merged author:${USER} -user:${USER} sort:created-desc`,
          login: USER,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    }

    const { data, errors } = await res.json();
    if (errors) throw new Error(JSON.stringify(errors));

    const prs: PR[] = data.search.nodes
      .filter((n: any) => n?.repository && !EXCLUDED.includes(n.repository.nameWithOwner))
      .map((n: any) => ({
        repo: n.repository.nameWithOwner,
        title: n.title,
        url: n.url,
        additions: n.additions,
        deletions: n.deletions,
      }));

    const cal = data.user.contributionsCollection.contributionCalendar;
    const days: Day[] = cal.weeks.flatMap((w: any) =>
      w.contributionDays.map((d: any) => ({
        date: d.date,
        count: d.contributionCount,
        level: LEVELS[d.contributionLevel] ?? 0,
      })),
    );

    return { prs, days, total: cal.totalContributions as number };
  } catch (e) {
    console.error('[github]', e);
    return { prs: [], days: [], total: 0 };
  }
}

let pending: Promise<GithubData> | undefined;
export const getGithubData = () => (pending ??= fetchGithubData());