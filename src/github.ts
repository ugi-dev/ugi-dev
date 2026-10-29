export interface Telemetry {
  repos: number;
  publicRepos: number;
  stars: number;
  followers: number;
  lastYear: number;
  allTime: number;
  weekly: number[];
  linesAdded: number;
  linesRemoved: number;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Oldest first, so a page of 100 covers the stars that matter for a past date.
// Only fetched for past dates: fine-grained tokens can't list stargazers, but can read the count.
const STARGAZERS = /* GraphQL */ `
  stargazerCount
  stargazers(first: 100, orderBy: { field: STARRED_AT, direction: ASC }) @include(if: $history) {
    totalCount
    edges { starredAt }
  }
`;

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!, $from: DateTime!, $to: DateTime!, $history: Boolean!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, first: 100) {
        totalCount
        nodes { nameWithOwner createdAt isPrivate ${STARGAZERS} }
      }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { contributionCount } }
        }
      }
    }
  }
`;

const WINDOW_QUERY = /* GraphQL */ `
  query Window($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { totalContributions }
      }
    }
  }
`;

const ORG_QUERY = /* GraphQL */ `
  query Org($org: String!, $history: Boolean!) {
    organization(login: $org) {
      repositories(first: 100) {
        nodes { nameWithOwner createdAt isPrivate ${STARGAZERS} }
      }
    }
  }
`;

interface Repo {
  nameWithOwner: string;
  createdAt: string;
  isPrivate: boolean;
  stargazerCount: number;
  stargazers?: { totalCount: number; edges: { starredAt: string }[] };
}

interface ProfileResponse {
  user: {
    createdAt: string;
    followers: { totalCount: number };
    repositories: { nodes: Repo[] };
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { contributionCount: number }[] }[];
      };
    };
  };
}

interface WindowResponse {
  user: { contributionsCollection: { contributionCalendar: { totalContributions: number } } };
}

interface OrgResponse {
  organization: { repositories: { nodes: Repo[] } };
}

/** Stars given before `until`. Past the first 100, assume the rest predate it too. */
function starsBefore(repos: Repo[], until: string) {
  return repos.reduce((sum, { stargazerCount, stargazers }) => {
    if (!stargazers) return sum + stargazerCount;
    const counted = stargazers.edges.filter((e) => e.starredAt < until).length;
    return sum + (counted === stargazers.edges.length ? stargazers.totalCount : counted);
  }, 0);
}

function client(token: string) {
  return async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const { data, errors } = (await res.json()) as { data: T; errors?: unknown[] };
    if (errors?.length) throw new Error(JSON.stringify(errors));
    return data;
  };
}

interface ContributorStats {
  author: { login: string } | null;
  weeks: { w: number; a: number; d: number }[];
}

/**
 * Lines `login` added and removed across `repos`, in weeks starting before `until`.
 * GitHub computes these stats lazily and answers 202 until they're ready, so keep asking.
 */
async function linesOfCode(token: string, login: string, repos: string[], until: Date) {
  const headers = { authorization: `bearer ${token}`, accept: "application/vnd.github+json" };
  const cutoff = until.getTime() / 1000;
  const totals = { added: 0, removed: 0 };
  let pending = repos;

  for (let attempt = 0; pending.length && attempt < 20; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 3000));
    const results = await Promise.all(
      pending.map(async (repo) => {
        const res = await fetch(`https://api.github.com/repos/${repo}/stats/contributors`, { headers });
        if (res.status === 202) return repo;
        if (res.status === 204) return null;
        if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}: ${await res.text()}`);
        const mine = ((await res.json()) as ContributorStats[]).find(
          (c) => c.author?.login.toLowerCase() === login.toLowerCase(),
        );
        for (const week of mine?.weeks ?? []) {
          if (week.w >= cutoff) continue;
          totals.added += week.a;
          totals.removed += week.d;
        }
        return null;
      }),
    );
    pending = results.filter((r) => r !== null);
  }

  if (pending.length) throw new Error(`Line stats still computing for ${pending.join(", ")}`);
  return totals;
}

/** GitHub caps a contributions window at one year, so slice the account's life into years. */
function yearlyWindows(since: Date, until: Date) {
  const windows: { from: string; to: string }[] = [];
  for (let start = since.getTime(); start < until.getTime(); start += YEAR_MS) {
    const end = Math.min(start + YEAR_MS, until.getTime());
    windows.push({ from: new Date(start).toISOString(), to: new Date(end).toISOString() });
  }
  return windows;
}

/**
 * Repos, stars and contributions are counted up to `until`, so a card can be rendered
 * as of a past date. Followers and repo visibility only exist as current values.
 */
export async function fetchTelemetry(
  login: string,
  orgs: string[],
  token: string,
  until: Date,
  history: boolean,
): Promise<Telemetry> {
  const graphql = client(token);
  const cutoff = until.toISOString();
  const lastYear = { from: new Date(until.getTime() - YEAR_MS).toISOString(), to: cutoff };
  const { user } = await graphql<ProfileResponse>(PROFILE_QUERY, { login, history, ...lastYear });

  const windows = yearlyWindows(new Date(user.createdAt), until);
  const [totals, orgRepos] = await Promise.all([
    Promise.all(
      windows.map((w) =>
        graphql<WindowResponse>(WINDOW_QUERY, { login, ...w }).then(
          (d) => d.user.contributionsCollection.contributionCalendar.totalContributions,
        ),
      ),
    ),
    Promise.all(
      orgs.map((org) =>
        graphql<OrgResponse>(ORG_QUERY, { org, history }).then((d) =>
          d.organization.repositories.nodes.filter((r) => r.createdAt < cutoff),
        ),
      ),
    ),
  ]);

  const repos = user.repositories.nodes.filter((r) => r.createdAt < cutoff);
  const calendar = user.contributionsCollection.contributionCalendar;
  const allRepos = [...repos, ...orgRepos.flat()];
  const lines = await linesOfCode(token, login, allRepos.map((r) => r.nameWithOwner), until);

  return {
    repos: allRepos.length,
    publicRepos: allRepos.filter((r) => !r.isPrivate).length,
    stars: starsBefore(allRepos, cutoff),
    followers: user.followers.totalCount,
    lastYear: calendar.totalContributions,
    allTime: totals.reduce((a, b) => a + b, 0),
    weekly: calendar.weeks
      .map((w) => w.contributionDays.reduce((sum, d) => sum + d.contributionCount, 0))
      .slice(-52),
    linesAdded: lines.added,
    linesRemoved: lines.removed,
  };
}
