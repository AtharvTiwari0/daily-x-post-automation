import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { logger } from '../logger';
import { retry } from '../utils/helpers';

let genAI: GoogleGenerativeAI | null = null;

if (config.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
} else {
  logger.warn('GEMINI_API_KEY is not set. Using mock Gemini responses.');
}

/**
 * Generates text from Gemini with the given prompt and system instructions.
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<string> {
  if (config.IS_DRY_RUN || !genAI) {
    logger.info(`[DRY RUN - Gemini Text API] Prompt: "${prompt.slice(0, 100)}..."`);
    return '[Mock Gemini Text Response]';
  }

  return retry(async () => {
    const model = genAI!.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }], role: 'system' } : undefined
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) {
      throw new Error('Gemini API returned an empty text response.');
    }
    return text.trim();
  }, { label: `Gemini Text Generation (${modelName})`, maxAttempts: 3 });
}

/**
 * Generates and parses structured JSON from Gemini.
 */
export async function generateJSON<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<T> {
  if (config.IS_DRY_RUN || !genAI) {
    logger.info(`[DRY RUN - Gemini JSON API] Prompt: "${prompt.slice(0, 100)}..."`);
    // Return a basic mock structure that caller functions would expect
    return {} as T;
  }

  return retry(async () => {
    const model = genAI!.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }], role: 'system' } : undefined,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) {
      throw new Error('Gemini API returned an empty JSON response.');
    }

    try {
      // Find the JSON block if it was wrapped in markdown (which sometimes happens even with responseMimeType config)
      let cleanedJson = text.trim();
      if (cleanedJson.startsWith('```json')) {
        cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();
      }
      return JSON.parse(cleanedJson) as T;
    } catch (err) {
      logger.error('Failed to parse Gemini response as JSON. Raw text: ' + text);
      throw new Error(`JSON parse error: ${(err as Error).message}`);
    }
  }, { label: `Gemini JSON Generation (${modelName})`, maxAttempts: 3 });
}
