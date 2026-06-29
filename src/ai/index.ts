import { generateJSON } from './gemini';
import { logger } from '../logger';
import { SINGLE_POST_GENERATION_PROMPT, SINGLE_POST_QUALITY_REVIEW_PROMPT, SYSTEM_INSTRUCTION_BASE } from '../prompts/templates';

export interface GeneratedContent {
  whyItMatters: string;
  xPost: string;
  estimatedEngagementScore: number;
}

interface RawGenerationResult {
  whyItMatters: string;
  xPost: string;
  estimatedEngagementScore: number;
}

interface QualityReviewResult {
  passed: boolean;
  feedback: string;
  correctedVersion: string | null;
}

/**
 * Truncates a string to 280 characters, adding ellipsis if truncated.
 */
function enforceLengthLimit(text: string, limit = 280): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit - 4).trim();
  return `${truncated}...`;
}

/**
 * Clean up text by removing outer quotes or typical AI framing.
 */
function cleanPostText(text: any): string {
  if (typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

/**
 * Generates, reviews, validates, and rates a single X post for a topic.
 */
export async function generateAndReviewPosts(
  topic: { title: string; source: string; url: string; description?: string }
): Promise<GeneratedContent> {
  logger.info(`Generating single X post for topic: "${topic.title.slice(0, 50)}..."`);

  const systemInstruction = SYSTEM_INSTRUCTION_BASE + '\nYou write engaging, developer-focused social posts.';
  
  // 1. Initial generation
  let rawGen: RawGenerationResult;
  try {
    rawGen = await generateJSON<RawGenerationResult>(SINGLE_POST_GENERATION_PROMPT(topic), systemInstruction);
  } catch (err) {
    logger.error('Failed to generate initial post via Gemini. Using fallbacks.', err);
    // Return mock/fallback content
    const fallbackText = `Found this interesting update about "${topic.title}": ${topic.url}`;
    return {
      whyItMatters: `This details a new development regarding ${topic.title}.`,
      xPost: enforceLengthLimit(fallbackText),
      estimatedEngagementScore: 70
    };
  }

  let xPost = cleanPostText(rawGen?.xPost || `Insights on developer trends: ${topic.title}. Check it out here: ${topic.url}`);
  let whyItMatters = (rawGen?.whyItMatters || `Interesting update on ${topic.title}.`).trim();
  let estimatedEngagementScore = Number(rawGen?.estimatedEngagementScore || 75);

  // Enforce 1-sentence limit on whyItMatters
  if (whyItMatters.includes('.') && whyItMatters.indexOf('.') < whyItMatters.length - 1) {
    whyItMatters = whyItMatters.split('.')[0] + '.';
  }

  // 2. Quality review loop (Self-review)
  logger.info(`Running quality review loop for generated post...`);
  try {
    const reviewPrompt = SINGLE_POST_QUALITY_REVIEW_PROMPT(topic.title, xPost, whyItMatters);
    const review = await generateJSON<QualityReviewResult>(reviewPrompt, systemInstruction);
    
    if (review) {
      logger.info(`Quality review result: Passed = ${review.passed}. Feedback: ${review.feedback}`);
      if (!review.passed && review.correctedVersion) {
        logger.info(`Applying Gemini corrected version for the post.`);
        xPost = cleanPostText(review.correctedVersion);
      }
    }
  } catch (err) {
    logger.warn('Failed to complete quality review via Gemini. Proceeding with raw post.', err);
  }

  // Final length double check programmatically
  xPost = enforceLengthLimit(xPost);

  return {
    whyItMatters,
    xPost,
    estimatedEngagementScore
  };
}
