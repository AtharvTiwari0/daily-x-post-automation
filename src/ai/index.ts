import { generateJSON } from './gemini';
import { logger } from '../logger';
import { SINGLE_POST_GENERATION_PROMPT, SINGLE_POST_QUALITY_REVIEW_PROMPT, SYSTEM_INSTRUCTION_BASE } from '../prompts/templates';

export interface GeneratedContent {
  engineeringInsight: string;
  whyDevelopersCare: string;
  businessImplication: string;
  strongerHook: string;
  xPost: string;
  mediaSuggestion: string;
  imagePrompt: string;
  hashtags: string[];
  estimatedEngagementScore: number;
}

interface RawGenerationResult {
  engineeringInsight: string;
  whyDevelopersCare: string;
  businessImplication: string;
  strongerHook: string;
  xPost: string;
  mediaSuggestion: string;
  imagePrompt: string;
  hashtags: string[];
  estimatedEngagementScore: number;
}

interface QualityReviewResult {
  passed: boolean;
  feedback: string;
  correctedVersion: RawGenerationResult | null;
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
      engineeringInsight: 'A new development is changing the dev landscape.',
      whyDevelopersCare: 'It streamlines development workflows.',
      businessImplication: 'Faster time to market and reduced compute cost.',
      strongerHook: `The truth about ${topic.title}`,
      xPost: enforceLengthLimit(fallbackText),
      mediaSuggestion: 'Comparison',
      imagePrompt: 'A programmer analyzing data on a computer screen, clean vector illustration',
      hashtags: ['coding', 'webdev', 'softwareengineering', 'developer', 'tech'],
      estimatedEngagementScore: 70
    };
  }

  let engineeringInsight = (rawGen?.engineeringInsight || `Interesting engineering details behind ${topic.title}.`).trim();
  let whyDevelopersCare = (rawGen?.whyDevelopersCare || `It streamlines development workflows.`).trim();
  let businessImplication = (rawGen?.businessImplication || `Improves time-to-market.`).trim();
  let strongerHook = (rawGen?.strongerHook || topic.title).trim();
  let xPost = cleanPostText(rawGen?.xPost || `Insights on developer trends: ${topic.title}. Check it out here: ${topic.url}`);
  let mediaSuggestion = (rawGen?.mediaSuggestion || 'None').trim();
  let imagePrompt = (rawGen?.imagePrompt || 'A programmer analyzing data on a computer screen, clean vector illustration').trim();
  let hashtags = Array.isArray(rawGen?.hashtags) ? rawGen.hashtags.map(t => t.trim().toLowerCase()) : ['coding', 'webdev', 'tech'];
  let estimatedEngagementScore = Number(rawGen?.estimatedEngagementScore || 75);

  // 2. Quality review loop (Self-review)
  logger.info(`Running quality review loop for generated post...`);
  try {
    const draft = {
      engineeringInsight,
      whyDevelopersCare,
      businessImplication,
      strongerHook,
      xPost,
      mediaSuggestion,
      imagePrompt,
      hashtags
    };
    const reviewPrompt = SINGLE_POST_QUALITY_REVIEW_PROMPT(topic.title, draft);
    const review = await generateJSON<QualityReviewResult>(reviewPrompt, systemInstruction);
    
    if (review) {
      logger.info(`Quality review result: Passed = ${review.passed}. Feedback: ${review.feedback}`);
      if (!review.passed && review.correctedVersion) {
        logger.info(`Applying Gemini corrected version for the post and insights.`);
        const corrected = review.correctedVersion;
        engineeringInsight = (corrected.engineeringInsight || engineeringInsight).trim();
        whyDevelopersCare = (corrected.whyDevelopersCare || whyDevelopersCare).trim();
        businessImplication = (corrected.businessImplication || businessImplication).trim();
        strongerHook = (corrected.strongerHook || strongerHook).trim();
        xPost = cleanPostText(corrected.xPost || xPost);
        mediaSuggestion = (corrected.mediaSuggestion || mediaSuggestion).trim();
        imagePrompt = (corrected.imagePrompt || imagePrompt).trim();
        hashtags = Array.isArray(corrected.hashtags) ? corrected.hashtags.map(t => t.trim().toLowerCase()) : hashtags;
        estimatedEngagementScore = Number(corrected.estimatedEngagementScore || estimatedEngagementScore);
      }
    }
  } catch (err) {
    logger.warn('Failed to complete quality review via Gemini. Proceeding with raw post.', err);
  }

  // Final length double check programmatically
  xPost = enforceLengthLimit(xPost);

  return {
    engineeringInsight,
    whyDevelopersCare,
    businessImplication,
    strongerHook,
    xPost,
    mediaSuggestion,
    imagePrompt,
    hashtags,
    estimatedEngagementScore
  };
}
