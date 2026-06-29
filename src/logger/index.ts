import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'run.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private write(level: string, message: string) {
    const formatted = this.formatMessage(level, message);
    console.log(formatted);

    try {
      this.ensureLogDirectory();
      fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
    } catch (err) {
      console.error(`Failed to write log to file: ${(err as Error).message}`);
    }
  }

  public info(message: string, ...args: any[]) {
    const formattedMsg = args.length ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : message;
    this.write('INFO', formattedMsg);
  }

  public warn(message: string, ...args: any[]) {
    const formattedMsg = args.length ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : message;
    this.write('WARN', formattedMsg);
  }

  public error(message: string, error?: any, ...args: any[]) {
    let errMsg = message;
    if (error) {
      if (error instanceof Error) {
        errMsg += ` | Error: ${error.message}\nStack: ${error.stack}`;
      } else {
        errMsg += ` | Error: ${JSON.stringify(error)}`;
      }
    }
    const formattedMsg = args.length ? `${errMsg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : errMsg;
    this.write('ERROR', formattedMsg);
  }

  public debug(message: string, ...args: any[]) {
    const formattedMsg = args.length ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : message;
    this.write('DEBUG', formattedMsg);
  }
}

export const logger = new Logger();
