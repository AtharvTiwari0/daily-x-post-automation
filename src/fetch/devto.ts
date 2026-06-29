import Parser from 'rss-parser';
import { logger } from '../logger';
import { RawTopic } from './hackernews';
import { retry, isWithinLast24Hours, normalizeUrl } from '../utils/helpers';

const parser = new Parser();

const DEVTO_FEEDS = [
  { name: 'General', url: 'https://dev.to/feed' },
  { name: 'React', url: 'https://dev.to/feed/tag/react' },
  { name: 'JavaScript', url: 'https://dev.to/feed/tag/javascript' },
  { name: 'AI', url: 'https://dev.to/feed/tag/ai' },
  { name: 'TypeScript', url: 'https://dev.to/feed/tag/typescript' },
  { name: 'Next.js', url: 'https://dev.to/feed/tag/nextjs' },
  { name: 'Flutter', url: 'https://dev.to/feed/tag/flutter' }
];

export async function fetchDevTo(): Promise<RawTopic[]> {
  logger.info('Fetching Dev.to RSS feeds...');
  const allArticlesMap = new Map<string, RawTopic>();

  for (const feed of DEVTO_FEEDS) {
    try {
      logger.info(`Fetching Dev.to feed for tag: ${feed.name}...`);
      const feedData = await retry(() => parser.parseURL(feed.url), {
        label: `Dev.to Feed [${feed.name}]`,
        maxAttempts: 2
      });

      let count = 0;
      for (const item of feedData.items) {
        if (!item.title || !item.link || !item.pubDate) continue;

        const pubDate = new Date(item.pubDate);
        if (!isWithinLast24Hours(pubDate)) continue;

        const normalized = normalizeUrl(item.link);
        
        if (allArticlesMap.has(normalized)) {
          // If already added, increase the engagement score (representing appearance in multiple categories)
          const existing = allArticlesMap.get(normalized)!;
          existing.engagementScore += 5;
          continue;
        }

        allArticlesMap.set(normalized, {
          title: item.title,
          url: item.link,
          source: 'DevTo',
          publishedAt: pubDate,
          // Base score is 10. If it appears in multiple tag feeds, it gets incremented.
          engagementScore: 10,
          description: item.contentSnippet || item.content
        });
        count++;
      }
      logger.info(`Fetched and filtered ${count} new articles from Dev.to tag: ${feed.name}.`);
    } catch (err) {
      logger.warn(`Failed to fetch Dev.to feed: ${feed.name}. Error: ${(err as Error).message}. Continuing...`);
    }
  }

  const result = Array.from(allArticlesMap.values());
  logger.info(`Successfully fetched and merged a total of ${result.length} unique Dev.to articles.`);
  return result;
}
