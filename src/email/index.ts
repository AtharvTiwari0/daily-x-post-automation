import * as nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../logger';
import { SelectedTopic } from '../ranking';
import { GeneratedContent } from '../ai';

export interface EmailData {
  topics: Array<{
    selection: SelectedTopic;
    content: GeneratedContent;
  }>;
  metadata: {
    executionTimeMs: number;
    topicsProcessed: number;
    sourcesUsed: string[];
  };
}

/**
 * Compiles a plain-text version matching the exact requested layout structure.
 */
function compileTextEmail(data: EmailData): string {
  let body = '';
  body += `================================================\n\n`;

  data.topics.forEach((item, index) => {
    body += `🔥 Topic #${index + 1}\n\n`;
    body += `${item.content.whyItMatters}\n\n`;
    body += `${item.content.xPost}\n\n`;
    body += `${item.selection.topic.url}\n\n`;
    body += `Estimated Engagement Score: ${item.content.estimatedEngagementScore}/100\n\n`;
    
    if (index < data.topics.length - 1) {
      body += `---\n\n`;
    }
  });

  body += `================================================\n`;
  return body;
}

/**
 * Compiles a visual, premium HTML version of the exact same content.
 * Keeps the structure identical but wraps it in a beautiful, responsive layout.
 */
function compileHtmlEmail(data: EmailData): string {
  let topicsHtml = '';

  data.topics.forEach((item, index) => {
    topicsHtml += `
      <div style="margin-bottom: 24px; border: 1px solid #e1e8ed; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
        <!-- Header / Topic Title -->
        <div style="background-color: #0f1419; padding: 16px 20px; border-bottom: 1px solid #e1e8ed;">
          <div style="font-size: 18px; font-weight: bold; color: #ffffff; display: flex; align-items: center;">
            <span style="margin-right: 8px;">🔥</span> Topic #${index + 1}: ${item.selection.topic.title.split(' - ')[0]}
          </div>
        </div>
        
        <div style="padding: 20px 24px;">
          <!-- Why it matters -->
          <div style="margin-bottom: 18px; font-size: 14px; color: #657786; font-style: italic; line-height: 1.5; border-left: 3px solid #ffad1f; padding-left: 12px;">
            <strong>Why it matters:</strong> ${item.content.whyItMatters}
          </div>

          <!-- The ready-to-post X Post (mono styled for copy-paste) -->
          <div style="margin-bottom: 18px; padding: 16px; background-color: #f8f9fa; border: 1px solid #e1e8ed; border-radius: 8px; position: relative;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #1da1f2; margin-bottom: 8px; letter-spacing: 0.5px;">Ready-to-post X Post:</div>
            <p style="margin: 0; color: #0f1419; font-size: 15px; line-height: 1.5; font-family: 'Courier New', Courier, monospace; white-space: pre-wrap;">${item.content.xPost}</p>
            <div style="margin-top: 10px; font-size: 11px; color: #888888; text-align: right;">
              ${item.content.xPost.length} / 280 characters
            </div>
          </div>

          <!-- Bottom details -->
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #657786;"><strong>Source Link:</strong></td>
              <td style="padding: 6px 0; text-align: right;">
                <a href="${item.selection.topic.url}" target="_blank" style="color: #1da1f2; text-decoration: none; font-weight: bold;">Original Article &rarr;</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #657786;"><strong>Estimated Engagement:</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #1da1f2; font-weight: bold; font-size: 14px;">
                ${item.content.estimatedEngagementScore}/100
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Today's X Posts</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f1419; font-size: 22px; font-weight: 800; margin: 0;">Today's X Posts</h1>
          <p style="color: #657786; font-size: 13px; margin: 4px 0 0 0;">Ready-to-publish updates curated for @iamatharv</p>
        </div>

        <!-- Topics -->
        ${topicsHtml}

        <!-- Footer -->
        <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e1e8ed; font-size: 11px; color: #657786;">
          <p style="margin: 0;">Curation took ${(data.metadata.executionTimeMs / 1000).toFixed(2)}s | Processed ${data.metadata.topicsProcessed} raw topics</p>
          <p style="margin: 4px 0 0 0;">Sent automatically by your Daily X Post Automation bot.</p>
        </div>

      </div>
    </body>
    </html>
  `;
}

/**
 * Sends the formatted email containing the 3 curated posts.
 */
export async function sendEmail(data: EmailData): Promise<boolean> {
  logger.info('Preparing to send Today\'s X Posts email...');

  const subject = "Today's X Posts";
  const textBody = compileTextEmail(data);
  const htmlBody = compileHtmlEmail(data);

  if (config.IS_DRY_RUN) {
    logger.info(`[DRY RUN - SMTP Email] To: ${config.GMAIL_EMAIL} | Subject: "${subject}"`);
    logger.info('Dry Run complete. Logged email preview below:\n' + textBody);
    return true;
  }

  return new Promise((resolve) => {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.GMAIL_EMAIL,
          pass: config.GMAIL_APP_PASSWORD
        }
      });

      const mailOptions = {
        from: `"X Post Bot" <${config.GMAIL_EMAIL}>`,
        to: config.GMAIL_EMAIL,
        subject: subject,
        text: textBody,
        html: htmlBody
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          logger.error('Failed to send email:', error);
          resolve(false);
        } else {
          logger.info(`Email sent successfully: ${info.response}`);
          resolve(true);
        }
      });
    } catch (err) {
      logger.error('SMTP Setup or sending threw error:', err);
      resolve(false);
    }
  });
}
