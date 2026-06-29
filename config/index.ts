import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file if it exists
dotenv.config();

export interface Config {
  GEMINI_API_KEY: string;
  GMAIL_EMAIL: string;
  GMAIL_APP_PASSWORD: string;
  GITHUB_TOKEN?: string; // Optional but highly recommended
  IS_DRY_RUN: boolean;
}

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

// Validate environment variables unless it's a dry run where we mock
if (!isDryRun) {
  const requiredEnv = ['GEMINI_API_KEY', 'GMAIL_EMAIL', 'GMAIL_APP_PASSWORD'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Reference .env.example for setup.`);
  }
}

export const config: Config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GMAIL_EMAIL: process.env.GMAIL_EMAIL || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  IS_DRY_RUN: isDryRun
};
