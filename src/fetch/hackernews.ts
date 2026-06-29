import { logger } from '../logger';
import { retry, isWithinLast24Hours } from '../utils/helpers';

export interface RawTopic {
  title: string;
  url: string;
  source: 'HackerNews' | 'DevTo' | 'GitHub';
  publishedAt: Date;
  engagementScore: number;
  description?: string;
}

export async function fetchHackerNews(): Promise<RawTopic[]> {
  logger.info('Fetching Hacker News top stories...');
  
  try {
    const topStoriesUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const response = await retry(() => fetch(topStoriesUrl), { label: 'Hacker News Top Stories list' });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch HN top stories: ${response.statusText}`);
    }

    const storyIds = (await response.json()) as number[];
    // We only need to check the top 50 stories to get recent popular ones
    const idsToFetch = storyIds.slice(0, 50);
    
    logger.info(`Fetching details for ${idsToFetch.length} Hacker News stories...`);
    
    const stories: RawTopic[] = [];
    
    // Fetch story details in batches to not overwhelm the system
    const batchSize = 10;
    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batchIds = idsToFetch.slice(i, i + batchSize);
      const batchPromises = batchIds.map(async (id) => {
        try {
          const detailUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
          const detailRes = await fetch(detailUrl);
          if (!detailRes.ok) return null;
          
          const storyData = (await detailRes.json()) as {
            id: number;
            type: string;
            by: string;
            time: number;
            title: string;
            url?: string;
            score: number;
            descendants?: number;
          };

          if (!storyData || storyData.type !== 'story') return null;

          const publishedDate = new Date(storyData.time * 1000);
          
          if (!isWithinLast24Hours(publishedDate)) {
            return null; // Ignore if older than 24h
          }

          // Use the linked URL, fallback to the HN thread URL
          const url = storyData.url || `https://news.ycombinator.com/item?id=${storyData.id}`;
          
          // Engagement score can be calculated as score (upvotes) + number of comments (descendants)
          const engagementScore = storyData.score + (storyData.descendants || 0);

          return {
            title: storyData.title,
            url,
            source: 'HackerNews' as const,
            publishedAt: publishedDate,
            engagementScore
          };
        } catch (err) {
          logger.warn(`Failed to fetch HN story detail for ID ${id}: ${(err as Error).message}`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const story of batchResults) {
        if (story) {
          stories.push(story);
        }
      }
    }

    logger.info(`Successfully fetched and filtered ${stories.length} stories from Hacker News.`);
    return stories;
  } catch (error) {
    logger.error('Error fetching Hacker News topics:', error);
    return []; // Return empty array to continue execution with other sources
  }
}
