import { logger } from './logger';
import { fetchHackerNews, RawTopic } from './fetch/hackernews';
import { fetchDevTo } from './fetch/devto';
import { fetchGitHub } from './fetch/github';
import { mergeDuplicates, filterTopicsByHistory, rankAndSelectTopics, SelectedTopic } from './ranking';
import { generateAndReviewPosts, GeneratedContent } from './ai';
import { sendEmail, EmailData } from './email';
import { addHistoryEntries, HistoryEntry } from './history';

/**
 * Main execution flow
 */
async function main() {
  const startTime = Date.now();
  logger.info('Daily AI X Post Automation workflow started.');

  // 1. Data Collection
  let hnTopics: RawTopic[] = [];
  let devToTopics: RawTopic[] = [];
  let githubTopics: RawTopic[] = [];

  logger.info('Starting parallel data collection from all sources...');
  
  // Fetch in parallel, but handle failures individually so one source failing doesn't stop the bot
  await Promise.all([
    (async () => {
      try {
        hnTopics = await fetchHackerNews();
      } catch (err) {
        logger.error('Failed fetching Hacker News:', err);
      }
    })(),
    (async () => {
      try {
        devToTopics = await fetchDevTo();
      } catch (err) {
        logger.error('Failed fetching Dev.to RSS:', err);
      }
    })(),
    (async () => {
      try {
        githubTopics = await fetchGitHub();
      } catch (err) {
        logger.error('Failed fetching GitHub repos:', err);
      }
    })()
  ]);

  const rawTopics = [...hnTopics, ...devToTopics, ...githubTopics];
  logger.info(`Collected a total of ${rawTopics.length} raw topics from all sources.`);

  if (rawTopics.length === 0) {
    logger.error('No topics collected from any source. Exiting.');
    return;
  }

  // 2. Merge duplicates
  const uniqueTopics = mergeDuplicates(rawTopics);

  // 3. Filter by history (semantic similarity)
  const filteredTopics = await filterTopicsByHistory(uniqueTopics);

  if (filteredTopics.length === 0) {
    logger.warn('All candidate topics filtered out by history. Proceeding with unfiltered unique topics to avoid empty run.');
  }
  const candidatesForSelection = filteredTopics.length > 0 ? filteredTopics : uniqueTopics;

  // 4. Rank and select top 3 topics
  const selected = await rankAndSelectTopics(candidatesForSelection);
  logger.info(`Top ${selected.length} topics selected:`, selected.map(s => s.topic.title));

  if (selected.length === 0) {
    logger.error('No topics selected for post generation. Exiting.');
    return;
  }

  // 5. Generate and review posts for each selected topic
  const topicsWithPosts: Array<{ selection: SelectedTopic; content: GeneratedContent }> = [];
  for (const selection of selected) {
    try {
      const content = await generateAndReviewPosts(selection.topic);
      topicsWithPosts.push({ selection, content });
    } catch (err) {
      logger.error(`Failed to generate posts for topic: "${selection.topic.title}":`, err);
    }
  }

  // 6. Calculate metadata and prepare email payload
  const executionTimeMs = Date.now() - startTime;
  const sourcesUsed = Array.from(new Set(rawTopics.map(t => t.source)));

  const emailData: EmailData = {
    topics: topicsWithPosts,
    metadata: {
      executionTimeMs,
      topicsProcessed: rawTopics.length,
      sourcesUsed
    }
  };

  // 7. Send the email via Gmail SMTP
  const emailSent = await sendEmail(emailData);

  // 8. Update state in history.json (only if email was successfully sent to avoid duplicate entries)
  if (emailSent) {
    const historyEntries: HistoryEntry[] = topicsWithPosts.map(item => {
      return {
        topic: item.selection.topic.title,
        source: item.selection.topic.source,
        url: item.selection.topic.url,
        generatedPost: item.content.xPost,
        date: new Date().toISOString().split('T')[0]
      };
    });
    addHistoryEntries(historyEntries);
    logger.info('History file updated successfully.');
  } else {
    logger.warn('Skipped updating history as email delivery failed.');
  }

  logger.info(`Daily workflow finished successfully in ${(executionTimeMs / 1000).toFixed(2)}s.`);
}

// Run the script
main().catch(err => {
  logger.error('Critical unhandled error in automation main entry:', err);
  process.exit(1);
});
