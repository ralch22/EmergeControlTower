import type { GeneratedContent } from "../types";

export interface BufferPost {
  text: string;
  media?: { link: string; photo?: string }[];
  scheduled_at?: string;
  profile_ids: string[];
}

export interface BufferProfile {
  id: string;
  service: string;
  formatted_username: string;
}

const BUFFER_API_BASE = "https://api.bufferapp.com/1";

async function bufferRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const accessToken = process.env.BUFFER_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error("BUFFER_ACCESS_TOKEN not configured");
  }

  const url = `${BUFFER_API_BASE}${endpoint}`;
  const separator = url.includes("?") ? "&" : "?";
  
  const response = await fetch(`${url}${separator}access_token=${accessToken}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Buffer API error: ${error}`);
  }

  return response.json();
}

export async function getBufferProfiles(): Promise<BufferProfile[]> {
  try {
    const data = await bufferRequest("/profiles.json");
    return data;
  } catch (error: any) {
    console.error("[Buffer] Failed to get profiles:", error.message);
    return [];
  }
}

export async function schedulePost(
  content: GeneratedContent,
  profileIds: string[],
  scheduledAt?: Date
): Promise<{ success: boolean; updateId?: string; error?: string }> {
  if (!process.env.BUFFER_ACCESS_TOKEN) {
    console.log("[Buffer] Access token not configured - skipping publish");
    return { success: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }

  try {
    const postData: any = {
      text: content.content,
      profile_ids: profileIds,
    };

    if (scheduledAt) {
      postData.scheduled_at = scheduledAt.toISOString();
    } else {
      postData.now = true;
    }

    if (content.metadata.mediaUrls && content.metadata.mediaUrls.length > 0) {
      postData.media = { link: content.metadata.mediaUrls[0] };
    }

    const result = await bufferRequest("/updates/create.json", {
      method: "POST",
      body: JSON.stringify(postData),
    });

    return {
      success: result.success,
      updateId: result.updates?.[0]?.id,
    };
  } catch (error: any) {
    console.error("[Buffer] Failed to schedule post:", error.message);
    return { success: false, error: error.message };
  }
}

export async function publishToBuffer(
  content: GeneratedContent,
  options: {
    platforms?: string[];
    scheduledAt?: Date;
  } = {}
): Promise<{ success: boolean; results: any[] }> {
  const profiles = await getBufferProfiles();
  
  if (profiles.length === 0) {
    return { success: false, results: [] };
  }

  const targetPlatforms = options.platforms || ["twitter", "linkedin", "facebook"];
  const targetProfiles = profiles.filter((p) =>
    targetPlatforms.some((platform) => p.service.toLowerCase().includes(platform))
  );

  if (targetProfiles.length === 0) {
    return { success: false, results: [] };
  }

  const profileIds = targetProfiles.map((p) => p.id);
  const result = await schedulePost(content, profileIds, options.scheduledAt);

  return {
    success: result.success,
    results: [result],
  };
}

export async function autoPublishApprovedContent(
  contents: GeneratedContent[]
): Promise<{ published: number; failed: number }> {
  let published = 0;
  let failed = 0;

  for (const content of contents) {
    if (content.status !== "approved") continue;
    
    if (["linkedin", "twitter", "instagram"].includes(content.type)) {
      const result = await publishToBuffer(content);
      if (result.success) {
        published++;
      } else {
        failed++;
      }
    }
  }

  return { published, failed };
}
