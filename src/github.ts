export interface Telemetry {
  repos: number;
  publicRepos: number;
  stars: number;
  followers: number;
  lastYear: number;
  allTime: number;
  weekly: number[];
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Oldest first, so a page of 100 covers the stars that matter for a past date.
const STARGAZERS = /* GraphQL */ `
  stargazers(first: 100, orderBy: { field: STARRED_AT, direction: ASC }) {
    totalCount
    edges { starredAt }
  }
`;

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, first: 100) {
        totalCount
        nodes { createdAt isPrivate ${STARGAZERS} }
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
  query Org($org: String!) {
    organization(login: $org) {
      repositories(first: 100) {
        nodes { createdAt ${STARGAZERS} }
      }
    }
  }
`;

interface Repo {
  createdAt: string;
  isPrivate: boolean;
  stargazers: { totalCount: number; edges: { starredAt: string }[] };
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
  organization: { repositories: { nodes: Omit<Repo, "isPrivate">[] } };
}

/** Stars given before `until`. Past the first 100, assume the rest predate it too. */
function starsBefore(repos: Omit<Repo, "isPrivate">[], until: string) {
  return repos.reduce((sum, { stargazers: { totalCount, edges } }) => {
    const counted = edges.filter((e) => e.starredAt < until).length;
    return sum + (counted === edges.length ? totalCount : counted);
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
export async function fetchTelemetry(login: string, orgs: string[], token: string, until: Date): Promise<Telemetry> {
  const graphql = client(token);
  const cutoff = until.toISOString();
  const lastYear = { from: new Date(until.getTime() - YEAR_MS).toISOString(), to: cutoff };
  const { user } = await graphql<ProfileResponse>(PROFILE_QUERY, { login, ...lastYear });

  const windows = yearlyWindows(new Date(user.createdAt), until);
  const [totals, orgStars] = await Promise.all([
    Promise.all(
      windows.map((w) =>
        graphql<WindowResponse>(WINDOW_QUERY, { login, ...w }).then(
          (d) => d.user.contributionsCollection.contributionCalendar.totalContributions,
        ),
      ),
    ),
    Promise.all(
      orgs.map((org) =>
        graphql<OrgResponse>(ORG_QUERY, { org }).then((d) => starsBefore(d.organization.repositories.nodes, cutoff)),
      ),
    ),
  ]);

  const repos = user.repositories.nodes.filter((r) => r.createdAt < cutoff);
  const calendar = user.contributionsCollection.contributionCalendar;

  return {
    repos: repos.length,
    publicRepos: repos.filter((r) => !r.isPrivate).length,
    stars: starsBefore(repos, cutoff) + orgStars.reduce((a, b) => a + b, 0),
    followers: user.followers.totalCount,
    lastYear: calendar.totalContributions,
    allTime: totals.reduce((a, b) => a + b, 0),
    weekly: calendar.weeks
      .map((w) => w.contributionDays.reduce((sum, d) => sum + d.contributionCount, 0))
      .slice(-52),
  };
}
