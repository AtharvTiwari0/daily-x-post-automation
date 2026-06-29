import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export interface HistoryEntry {
  topic: string;
  source: string;
  url: string;
  generatedPost: string;
  date: string; // ISO date string (YYYY-MM-DD)
}

const HISTORY_DIR = path.join(process.cwd(), 'history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');

export function ensureHistoryDirectory() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

export function readHistory(): HistoryEntry[] {
  ensureHistoryDirectory();
  
  if (!fs.existsSync(HISTORY_FILE)) {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    } catch (err) {
      logger.error('Failed to initialize empty history file:', err);
      return [];
    }
  }

  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data) as HistoryEntry[];
  } catch (err) {
    logger.error('Failed to read or parse history file:', err);
    return [];
  }
}

export function writeHistory(entries: HistoryEntry[]): boolean {
  ensureHistoryDirectory();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf8');
    logger.info(`Successfully wrote ${entries.length} items to history.`);
    return true;
  } catch (err) {
    logger.error('Failed to write history file:', err);
    return false;
  }
}

export function addHistoryEntries(newEntries: HistoryEntry[]) {
  const current = readHistory();
  const updated = [...current, ...newEntries];
  writeHistory(updated);
}

export function getRecentHistory(days: number = 30): HistoryEntry[] {
  const history = readHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return history.filter(entry => {
    const entryDate = new Date(entry.date);
    return !isNaN(entryDate.getTime()) && entryDate >= cutoffDate;
  });
}
