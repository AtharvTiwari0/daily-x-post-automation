import { logger } from '../logger';
import { RawTopic } from './hackernews';
import { config } from '../../config';
import { retry, isWithinLast24Hours } from '../utils/helpers';

export async function fetchGitHub(): Promise<RawTopic[]> {
  logger.info('Fetching GitHub trending/popular repositories...');
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'daily-x-post-automation-bot'
  };

  if (config.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${config.GITHUB_TOKEN}`;
  } else {
    logger.warn('GITHUB_TOKEN is not set. GitHub search calls will be subject to strict public rate limits.');
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  // Construct queries
  // Query 1: Repos created in the last 24h with stars > 10
  // Query 2: Repos with topic "developer-tools" pushed in the last 24h, stars > 50
  // Query 3: Repos with topic "ai" pushed in the last 24h, stars > 100
  const queries = [
    `created:>${dateStr} stars:>10`,
    `topic:developer-tools pushed:>${dateStr} stars:>50`,
    `topic:ai pushed:>${dateStr} stars:>100`
  ];

  const reposMap = new Map<string, RawTopic>();

  for (const query of queries) {
    try {
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`;
      logger.info(`Running GitHub search query: "${query}"...`);

      const res = await retry(async () => {
        const response = await fetch(searchUrl, { headers });
        if (response.status === 403) {
          const rateLimitReset = response.headers.get('X-RateLimit-Reset');
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'unknown';
          throw new Error(`GitHub Rate Limit Exceeded. Reset at ${resetTime}.`);
        }
        if (!response.ok) {
          throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
        }
        return response;
      }, { label: `GitHub Search [${query}]`, maxAttempts: 2 });

      const data = (await res.json()) as {
        items?: Array<{
          full_name: string;
          html_url: string;
          description: string | null;
          stargazers_count: number;
          forks_count: number;
          created_at: string;
          pushed_at: string;
        }>;
      };

      if (!data.items || data.items.length === 0) {
        continue;
      }

      let addedCount = 0;
      for (const item of data.items) {
        const publishedDate = new Date(item.created_at);
        const pushedDate = new Date(item.pushed_at);
        
        // We accept if created or pushed in the last 24h
        if (!isWithinLast24Hours(publishedDate) && !isWithinLast24Hours(pushedDate)) {
          continue;
        }

        const engagementScore = item.stargazers_count + item.forks_count;
        const url = item.html_url;

        if (reposMap.has(url)) {
          continue;
        }

        reposMap.set(url, {
          title: `${item.full_name}${item.description ? ` - ${item.description}` : ''}`,
          url,
          source: 'GitHub',
          publishedAt: publishedDate.getTime() > pushedDate.getTime() ? publishedDate : pushedDate,
          engagementScore,
          description: item.description || undefined
        });
        addedCount++;
      }
      logger.info(`Fetched and filtered ${addedCount} repositories from query: "${query}"`);
    } catch (err) {
      logger.warn(`GitHub Search API query "${query}" failed: ${(err as Error).message}`);
    }
  }

  // Fallback: If no repos fetched, attempt a generic popular repositories query updated recently
  if (reposMap.size === 0) {
    logger.warn('GitHub specific queries returned no items. Attempting generic popular fallback...');
    try {
      const fallbackQuery = `stars:>1000 pushed:>${dateStr}`;
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(fallbackQuery)}&sort=updated&order=desc&per_page=15`;
      
      const res = await fetch(searchUrl, { headers });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.items) {
          for (const item of data.items) {
            const url = item.html_url;
            reposMap.set(url, {
              title: `${item.full_name}${item.description ? ` - ${item.description}` : ''}`,
              url,
              source: 'GitHub',
              publishedAt: new Date(item.pushed_at),
              engagementScore: item.stargazers_count + item.forks_count,
              description: item.description || undefined
            });
          }
          logger.info(`Successfully loaded ${data.items.length} repositories from GitHub fallback query.`);
        }
      }
    } catch (err) {
      logger.error('GitHub fallback query failed:', err);
    }
  }

  const result = Array.from(reposMap.values());
  logger.info(`Total unique GitHub repositories collected: ${result.length}`);
  return result;
}
