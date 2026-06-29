import { RawTopic } from '../fetch/hackernews';
import { HistoryEntry, getRecentHistory } from '../history';
import { generateJSON } from '../ai/gemini';
import { logger } from '../logger';
import { normalizeUrl } from '../utils/helpers';
import { HISTORY_FILTER_PROMPT, RANKING_PROMPT, SYSTEM_INSTRUCTION_BASE } from '../prompts/templates';

/**
 * Merges raw topics from multiple sources by normalizing URLs.
 * Keeps the item with the highest engagement score.
 */
export function mergeDuplicates(topics: RawTopic[]): RawTopic[] {
  const mergedMap = new Map<string, RawTopic>();

  for (const topic of topics) {
    const normalized = normalizeUrl(topic.url);
    if (mergedMap.has(normalized)) {
      const existing = mergedMap.get(normalized)!;
      // Merge and keep the higher engagement score
      existing.engagementScore = Math.max(existing.engagementScore, topic.engagementScore);
      // Append source if it comes from multiple sources
      if (!existing.source.includes(topic.source)) {
        existing.source = `${existing.source}, ${topic.source}` as any;
      }
    } else {
      mergedMap.set(normalized, { ...topic });
    }
  }

  const result = Array.from(mergedMap.values());
  logger.info(`Merged duplicates: Reduced ${topics.length} topics to ${result.length} unique topics.`);
  return result;
}

/**
 * Filter candidates using Gemini semantic similarity against history.
 */
export async function filterTopicsByHistory(candidates: RawTopic[]): Promise<RawTopic[]> {
  logger.info('Filtering candidate topics against 30-day history...');
  
  const recentHistory = getRecentHistory(30);
  if (recentHistory.length === 0) {
    logger.info('No history found for the last 30 days. Skipping semantic check.');
    return candidates;
  }

  const historyList = recentHistory.map(h => ({
    topic: h.topic,
    url: h.url
  }));

  const candidateList = candidates.map(c => ({
    title: c.title,
    url: c.url
  }));

  try {
    const prompt = HISTORY_FILTER_PROMPT(candidateList, historyList);
    const systemInstruction = SYSTEM_INSTRUCTION_BASE + '\nYou are filtering duplicate topics.';
    
    interface FilterResult {
      nonDuplicateIndices: number[];
    }

    const result = await generateJSON<FilterResult>(prompt, systemInstruction);
    
    if (result && Array.isArray(result.nonDuplicateIndices)) {
      const filtered = result.nonDuplicateIndices
        .map(idx => candidates[idx])
        .filter(topic => !!topic);
      
      logger.info(`Semantic filtering complete. Kept ${filtered.length} of ${candidates.length} candidate topics.`);
      return filtered;
    }
    
    logger.warn('Invalid response from semantic filter. Falling back to simple URL match filtering.');
  } catch (error) {
    logger.error('Error during semantic similarity history check:', error);
  }

  // Fallback: Simple exact URL matching against recent history
  const recentUrls = new Set(recentHistory.map(h => normalizeUrl(h.url)));
  const filtered = candidates.filter(c => !recentUrls.has(normalizeUrl(c.url)));
  logger.info(`Fallback URL filtering complete. Kept ${filtered.length} of ${candidates.length} topics.`);
  return filtered;
}

export interface SelectedTopic {
  topic: RawTopic;
  whySelected: string;
}

/**
 * Uses Gemini to rank and select the top 3 topics.
 */
export async function rankAndSelectTopics(topics: RawTopic[]): Promise<SelectedTopic[]> {
  logger.info(`Ranking and selecting top 3 topics from ${topics.length} candidate topics...`);
  
  if (topics.length === 0) {
    return [];
  }

  // If there are 3 or fewer topics, select all of them with default explanations
  if (topics.length <= 3) {
    logger.info(`Only ${topics.length} topics available. Selecting all without Gemini call.`);
    return topics.map(t => ({
      topic: t,
      whySelected: 'Selected automatically as there were 3 or fewer trending topics available today.'
    }));
  }

  try {
    const prompt = RANKING_PROMPT(topics);
    const systemInstruction = SYSTEM_INSTRUCTION_BASE + '\nYou are selecting the best developer trends to share.';
    
    interface RankResult {
      selectedTopics: Array<{
        index: number;
        whySelected: string;
      }>;
    }

    const result = await generateJSON<RankResult>(prompt, systemInstruction);
    
    if (result && Array.isArray(result.selectedTopics)) {
      const selected: SelectedTopic[] = result.selectedTopics
        .map(selection => {
          const topic = topics[selection.index];
          if (!topic) return null;
          return {
            topic,
            whySelected: selection.whySelected
          };
        })
        .filter((s): s is SelectedTopic => s !== null);

      if (selected.length > 0) {
        logger.info(`Successfully selected the top ${selected.length} topics via Gemini ranking.`);
        return selected.slice(0, 3); // Ensure max 3
      }
    }
    logger.warn('Gemini ranking returned invalid results. Falling back to sorting by engagement score.');
  } catch (error) {
    logger.error('Error ranking topics with Gemini:', error);
  }

  // Fallback: Sort by engagement score descending and take the top 3
  logger.info('Sorting by engagement score to select top 3 topics...');
  const sorted = [...topics].sort((a, b) => b.engagementScore - a.engagementScore);
  const selected = sorted.slice(0, 3).map(t => ({
    topic: t,
    whySelected: `Selected automatically based on engagement score (${t.engagementScore}) as fallback.`
  }));

  return selected;
}
