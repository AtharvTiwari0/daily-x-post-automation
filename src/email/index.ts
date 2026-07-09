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
    body += `🔥 Topic #${index + 1}: ${item.selection.topic.title}\n\n`;
    body += `💡 Stronger Hook: ${item.content.strongerHook}\n\n`;
    body += `🛠️ Surprising Engineering Insight:\n${item.content.engineeringInsight}\n\n`;
    body += `🧑‍💻 Why Developers Care:\n${item.content.whyDevelopersCare}\n\n`;
    body += `💼 Business Implication:\n${item.content.businessImplication}\n\n`;
    body += `📝 Ready-to-post X Post:\n${item.content.xPost}\n\n`;
    body += `🎨 Media Suggestion: ${item.content.mediaSuggestion}\n`;
    body += `📸 Image Prompt: ${item.content.imagePrompt}\n`;
    body += `🏷️ Hashtags: ${item.content.hashtags.map(h => `#${h}`).join(' ')}\n\n`;
    body += `Link: ${item.selection.topic.url}\n`;
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
    const hashtagsHtml = item.content.hashtags
      .map(tag => `<span style="display: inline-block; background-color: #e8f5fe; color: #1da1f2; padding: 3px 8px; margin: 2px; border-radius: 12px; font-size: 12px; font-weight: 500;">#${tag}</span>`)
      .join(' ');

    topicsHtml += `
      <div style="margin-bottom: 32px; border: 1px solid #e1e8ed; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background-color: #0f1419; padding: 18px 24px; border-bottom: 1px solid #1f2937;">
          <div style="font-size: 16px; font-weight: 600; color: #1da1f2; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Topic #${index + 1}</div>
          <div style="font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.3;">
            ${item.selection.topic.title}
          </div>
        </div>
        
        <div style="padding: 24px;">
          <!-- Stronger Hook Suggestion -->
          <div style="margin-bottom: 20px; padding: 12px 16px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px dashed #f59e0b; border-radius: 8px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #b45309; margin-bottom: 4px; letter-spacing: 0.5px;">⚡ Stronger Hook Suggestion:</div>
            <div style="font-size: 14px; font-weight: 700; color: #78350f;">"${item.content.strongerHook}"</div>
          </div>

          <!-- Hidden Engineering Insight -->
          <div style="margin-bottom: 16px; border-left: 4px solid #3b82f6; padding-left: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #3b82f6; margin-bottom: 4px; letter-spacing: 0.5px;">🛠️ Surprising Engineering Insight:</div>
            <div style="font-size: 14px; line-height: 1.5; color: #1f2937; font-weight: 500;">
              ${item.content.engineeringInsight}
            </div>
          </div>

          <!-- Why Developers Care -->
          <div style="margin-bottom: 16px; border-left: 4px solid #10b981; padding-left: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #10b981; margin-bottom: 4px; letter-spacing: 0.5px;">🧑‍💻 Why Developers Care:</div>
            <div style="font-size: 14px; line-height: 1.5; color: #1f2937;">
              ${item.content.whyDevelopersCare}
            </div>
          </div>

          <!-- Business Implication -->
          <div style="margin-bottom: 20px; border-left: 4px solid #8b5cf6; padding-left: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #8b5cf6; margin-bottom: 4px; letter-spacing: 0.5px;">💼 Business Implication:</div>
            <div style="font-size: 14px; line-height: 1.5; color: #1f2937;">
              ${item.content.businessImplication}
            </div>
          </div>

          <!-- Ready to Publish X Post -->
          <div style="margin-bottom: 20px; padding: 18px; background-color: #f8f9fa; border: 1px solid #e1e8ed; border-radius: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #1da1f2; margin-bottom: 10px; letter-spacing: 0.5px;">📝 Ready-to-post X Post (under 280 chars):</div>
            <p style="margin: 0; color: #0f1419; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 500; white-space: pre-wrap;">${item.content.xPost}</p>
            <div style="margin-top: 12px; font-size: 11px; color: #657786; text-align: right; font-weight: bold;">
              ${item.content.xPost.length} / 280 characters
            </div>
          </div>

          <!-- Media suggestion & Image Prompt -->
          <div style="margin-bottom: 20px; padding: 14px; background-color: #f3f4f6; border-radius: 8px;">
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 12px; font-weight: bold; color: #4b5563;">🎨 Media Recommendation:</span>
              <span style="display: inline-block; background-color: #1f2937; color: #ffffff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${item.content.mediaSuggestion}
              </span>
            </div>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 10px;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #6b7280; margin-bottom: 4px; letter-spacing: 0.5px;">📸 Image Prompt:</div>
              <div style="font-size: 13px; color: #4b5563; font-style: italic; line-height: 1.4;">
                "${item.content.imagePrompt}"
              </div>
            </div>
          </div>

          <!-- Hashtags -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #657786; margin-bottom: 6px; letter-spacing: 0.5px;">🏷️ Hashtags (5-8):</div>
            <div>${hashtagsHtml}</div>
          </div>

          <!-- Footer/Action details -->
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
            <tr>
              <td style="padding: 10px 0; color: #657786;"><strong>Source Link:</strong></td>
              <td style="padding: 10px 0; text-align: right;">
                <a href="${item.selection.topic.url}" target="_blank" style="color: #1da1f2; text-decoration: none; font-weight: bold;">Original Article &rarr;</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #657786;"><strong>Estimated Engagement Score:</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #1da1f2; font-weight: bold; font-size: 15px;">
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

  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  if (!isGitHubActions) {
    logger.info(`[LOCAL DEVELOPMENT - SMTP Email Skipped] Subject: "${subject}"`);
    logger.info('Live email triggers are disabled during local development to avoid test spam. Email preview is printed below:\n' + textBody);
    return true;
  }

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
