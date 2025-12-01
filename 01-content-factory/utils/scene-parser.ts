export interface ParsedScene {
  sceneNumber: number;
  title?: string;
  visualPrompt: string;
  voiceoverText: string;
  duration: number;
  startTime: number;
  imageUrl?: string;
}

export interface VideoScript {
  title?: string;
  hook?: string;
  scenes?: Array<{
    visualDescription?: string;
    voiceover?: string;
    duration?: number | string;
  }>;
  voiceoverText?: string;
  cta?: string;
  callToAction?: string;
}

export function parseVideoScript(content: string): ParsedScene[] {
  let scriptData: VideoScript;
  
  try {
    scriptData = JSON.parse(content);
  } catch (e) {
    return parseTextScript(content);
  }

  const scenes: ParsedScene[] = [];
  let currentTime = 0;

  if (scriptData.hook) {
    const hookDuration = estimateDuration(scriptData.hook);
    scenes.push({
      sceneNumber: 1,
      title: "Hook",
      visualPrompt: generateVisualPrompt(scriptData.hook),
      voiceoverText: scriptData.hook,
      duration: hookDuration,
      startTime: currentTime,
    });
    currentTime += hookDuration;
  }

  if (scriptData.scenes && Array.isArray(scriptData.scenes)) {
    scriptData.scenes.forEach((scene, index) => {
      const sceneDuration = parseDuration(scene.duration) || estimateDuration(scene.voiceover || '');
      
      scenes.push({
        sceneNumber: scenes.length + 1,
        title: `Scene ${index + 1}`,
        visualPrompt: scene.visualDescription || generateVisualPrompt(scene.voiceover || ''),
        voiceoverText: scene.voiceover || '',
        duration: sceneDuration,
        startTime: currentTime,
      });
      currentTime += sceneDuration;
    });
  }

  if (!scriptData.scenes && scriptData.voiceoverText) {
    const paragraphs = scriptData.voiceoverText.split(/\n\n+/).filter(p => p.trim());
    
    paragraphs.forEach((para, index) => {
      const paraDuration = estimateDuration(para);
      scenes.push({
        sceneNumber: scenes.length + 1,
        title: `Section ${index + 1}`,
        visualPrompt: generateVisualPrompt(para),
        voiceoverText: para.trim(),
        duration: paraDuration,
        startTime: currentTime,
      });
      currentTime += paraDuration;
    });
  }

  const cta = scriptData.cta || scriptData.callToAction;
  if (cta) {
    const ctaDuration = estimateDuration(cta);
    scenes.push({
      sceneNumber: scenes.length + 1,
      title: "Call to Action",
      visualPrompt: "Professional call-to-action screen with company branding, contact information displayed prominently",
      voiceoverText: cta,
      duration: ctaDuration,
      startTime: currentTime,
    });
  }

  return normalizeSceneDurations(scenes);
}

function parseTextScript(content: string): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let currentTime = 0;

  const sectionPatterns = [
    /^#{1,3}\s+(.+)$/gm,
    /^\*\*(.+)\*\*$/gm,
    /^Scene\s+\d+[:\s]+(.+)$/gim,
    /^\d+\.\s+(.+)$/gm,
  ];

  let sections: string[] = [];
  let matched = false;

  for (const pattern of sectionPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 1) {
      sections = content.split(pattern).filter(s => s.trim());
      matched = true;
      break;
    }
  }

  if (!matched) {
    sections = content.split(/\n\n+/).filter(s => s.trim());
  }

  sections.forEach((section, index) => {
    const text = section.trim();
    if (text.length < 10) return;

    const duration = estimateDuration(text);
    
    scenes.push({
      sceneNumber: scenes.length + 1,
      title: extractTitle(text) || `Section ${index + 1}`,
      visualPrompt: generateVisualPrompt(text),
      voiceoverText: cleanText(text),
      duration,
      startTime: currentTime,
    });
    currentTime += duration;
  });

  return normalizeSceneDurations(scenes);
}

function estimateDuration(text: string): number {
  if (!text) return 5;
  
  const words = text.split(/\s+/).length;
  const wordsPerSecond = 2.5;
  const duration = Math.ceil(words / wordsPerSecond);
  
  return Math.max(5, Math.min(duration, 10));
}

function parseDuration(duration: number | string | undefined): number | null {
  if (!duration) return null;
  
  if (typeof duration === 'number') {
    return Math.max(5, Math.min(duration, 10));
  }
  
  const match = duration.match(/(\d+)/);
  if (match) {
    return Math.max(5, Math.min(parseInt(match[1]), 10));
  }
  
  return null;
}

function generateVisualPrompt(text: string): string {
  const keywords = extractKeywords(text);
  
  const visualStyle = "professional, cinematic lighting, high quality, 4K, modern corporate aesthetic";
  
  if (keywords.length > 0) {
    return `${keywords.slice(0, 5).join(', ')}. ${visualStyle}`;
  }
  
  return `Business professional scene related to: ${text.substring(0, 100)}. ${visualStyle}`;
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
    'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that',
    'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they',
    'their', 'what', 'which', 'who', 'whom'
  ]);

  return words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .filter(word => /^[a-z]+$/.test(word))
    .slice(0, 10);
}

function extractTitle(text: string): string | null {
  const firstLine = text.split('\n')[0].trim();
  
  if (firstLine.length < 50 && firstLine.length > 3) {
    return firstLine.replace(/^[#*\-\d.]+\s*/, '').trim();
  }
  
  return null;
}

function cleanText(text: string): string {
  return text
    .replace(/^[#*\-\d.]+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function normalizeSceneDurations(scenes: ParsedScene[]): ParsedScene[] {
  return scenes.map(scene => ({
    ...scene,
    duration: Math.max(5, Math.min(scene.duration, 10)),
  }));
}

export function calculateTotalDuration(scenes: ParsedScene[]): number {
  return scenes.reduce((total, scene) => total + scene.duration, 0);
}

export function validateVideoScript(scenes: ParsedScene[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (scenes.length === 0) {
    errors.push("No scenes found in script");
  }

  if (scenes.length > 20) {
    errors.push("Too many scenes (max 20)");
  }

  const totalDuration = calculateTotalDuration(scenes);
  if (totalDuration > 120) {
    errors.push(`Total duration too long: ${totalDuration}s (max 120s)`);
  }

  scenes.forEach((scene, index) => {
    if (!scene.visualPrompt) {
      errors.push(`Scene ${index + 1} missing visual prompt`);
    }
    if (!scene.voiceoverText) {
      errors.push(`Scene ${index + 1} missing voiceover text`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
