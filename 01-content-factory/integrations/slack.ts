import type { GeneratedContent, QAResult } from "../types";

export interface SlackNotification {
  channel?: string;
  text: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: any[];
  accessory?: any;
}

export async function sendSlackNotification(
  notification: SlackNotification
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[Slack] Webhook URL not configured - skipping notification");
    return { success: false, error: "SLACK_WEBHOOK_URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Slack] Failed to send notification:", error.message);
    return { success: false, error: error.message };
  }
}

export async function notifyContentReady(
  content: GeneratedContent,
  qaResult: QAResult,
  approvalUrl: string
): Promise<void> {
  const statusEmoji = qaResult.passed ? "✅" : "⚠️";
  const scoreColor = qaResult.score >= 90 ? "good" : qaResult.score >= 75 ? "warning" : "danger";

  const notification: SlackNotification = {
    text: `${statusEmoji} New content ready for review: ${content.title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusEmoji} Content Ready for Review`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${content.title}*\n_Type: ${content.type} | Score: ${qaResult.score}/100_`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Preview:*\n\`\`\`${content.content.substring(0, 300)}${content.content.length > 300 ? "..." : ""}\`\`\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ Approve" },
            style: "primary",
            url: `${approvalUrl}?action=approve&id=${content.id}`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "❌ Reject" },
            style: "danger",
            url: `${approvalUrl}?action=reject&id=${content.id}`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "👀 View Full" },
            url: `${approvalUrl}?id=${content.id}`,
          },
        ],
      },
    ],
  };

  await sendSlackNotification(notification);
}

export async function notifyRunComplete(
  runId: string,
  stats: {
    totalPieces: number;
    passed: number;
    failed: number;
    byType: Record<string, number>;
  },
  dashboardUrl: string
): Promise<void> {
  const typeBreakdown = Object.entries(stats.byType)
    .map(([type, count]) => `• ${type}: ${count}`)
    .join("\n");

  const notification: SlackNotification = {
    text: `🚀 Content run ${runId} completed! ${stats.totalPieces} pieces generated.`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚀 Content Factory Run Complete",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Run ID:* \`${runId}\`\n*Total Pieces:* ${stats.totalPieces}\n*Passed QA:* ${stats.passed}\n*Needs Review:* ${stats.failed}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Breakdown by Type:*\n${typeBreakdown}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "📊 View Dashboard" },
            style: "primary",
            url: dashboardUrl,
          },
        ],
      },
    ],
  };

  await sendSlackNotification(notification);
}
