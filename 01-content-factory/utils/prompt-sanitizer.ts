const PROBLEMATIC_PATTERNS = [
  /\bviolent?\b/gi,
  /\bweapon(s)?\b/gi,
  /\bgun(s)?\b/gi,
  /\bkill(ing|ed|s)?\b/gi,
  /\bblood(y)?\b/gi,
  /\bdeath\b/gi,
  /\bdead\b/gi,
  /\bexplosi(on|ve)(s)?\b/gi,
  /\bwar\b/gi,
  /\battack(s|ing|ed)?\b/gi,
  /\bdestro(y|ying|yed)\b/gi,
  /\bdamage(d|s|ing)?\b/gi,
  /\bcrash(es|ed|ing)?\b/gi,
  /\bfraud(ulent)?\b/gi,
  /\bscam(s|ming|med)?\b/gi,
  /\bsteal(ing)?\b/gi,
  /\btheft\b/gi,
  /\bhack(ed|ing|er)?\b/gi,
  /\bbreach(es|ed)?\b/gi,
  /\bmalware\b/gi,
  /\bransomware\b/gi,
  /\bvirus(es)?\b/gi,
  /\bpanic(king)?\b/gi,
  /\bfear(ful)?\b/gi,
  /\bterror(ism|ist)?\b/gi,
  /\bburn(ing|ed|s)?\b/gi,
  /\bfire\b/gi,
  /\bdisaster(s)?\b/gi,
  /\bcatastroph(e|ic)\b/gi,
  /\binjur(y|ies|ed)\b/gi,
  /\bharm(ful|ed|ing)?\b/gi,
  /\bpain(ful)?\b/gi,
  /\bsuffer(ing|ed|s)?\b/gi,
  /\bloss(es)?\b/gi,
  /\bcrisis\b/gi,
  /\bemergency\b/gi,
  /\balarming\b/gi,
  /\bshock(ing|ed)?\b/gi,
  /\bscare(d|s)?\b/gi,
  /\bdanger(ous)?\b/gi,
  /\bthreat(en|s|ening)?\b/gi,
  /\brisk(y|s)?\b/gi,
  /\bworr(y|ied|ies)\b/gi,
  /\banxi(ety|ous)\b/gi,
  /\bstress(ed|ful)?\b/gi,
];

const SAFE_REPLACEMENTS: Record<string, string> = {
  'fraud': 'challenge',
  'fraudulent': 'problematic',
  'scam': 'issue',
  'attack': 'event',
  'breach': 'incident',
  'hack': 'access',
  'hacker': 'actor',
  'threat': 'situation',
  'danger': 'concern',
  'risk': 'consideration',
  'crisis': 'situation',
  'emergency': 'priority',
  'disaster': 'event',
  'loss': 'change',
  'damage': 'impact',
  'destroy': 'affect',
  'crash': 'slowdown',
  'fire': 'glow',
  'burn': 'transform',
  'pain': 'discomfort',
  'fear': 'concern',
  'panic': 'urgency',
  'alarm': 'notification',
  'shock': 'surprise',
  'worry': 'consider',
  'stress': 'pressure',
};

export function sanitizeVideoPrompt(prompt: string): { 
  sanitized: string; 
  wasModified: boolean;
  removedTerms: string[];
} {
  let sanitized = prompt;
  const removedTerms: string[] = [];
  let wasModified = false;
  
  for (const [term, replacement] of Object.entries(SAFE_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(sanitized)) {
      removedTerms.push(term);
      sanitized = sanitized.replace(regex, replacement);
      wasModified = true;
    }
  }
  
  for (const pattern of PROBLEMATIC_PATTERNS) {
    if (pattern.test(sanitized)) {
      const match = sanitized.match(pattern);
      if (match) {
        removedTerms.push(match[0]);
        sanitized = sanitized.replace(pattern, '');
        wasModified = true;
      }
    }
  }
  
  sanitized = sanitized
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
  
  return { sanitized, wasModified, removedTerms };
}

export function makePromptBusinessFriendly(prompt: string): string {
  const { sanitized } = sanitizeVideoPrompt(prompt);
  
  const businessPhrases = [
    'professional business setting',
    'modern corporate environment',
    'clean minimalist aesthetic',
    'bright optimistic lighting',
    'smooth camera movement',
  ];
  
  const hasBusinessContext = businessPhrases.some(phrase => 
    sanitized.toLowerCase().includes(phrase.toLowerCase())
  );
  
  if (!hasBusinessContext) {
    return `${sanitized}. Professional business context, clean modern aesthetic, smooth cinematic movement.`;
  }
  
  return sanitized;
}

export function sanitizeForVeo(prompt: string): string {
  const { sanitized, wasModified, removedTerms } = sanitizeVideoPrompt(prompt);
  
  if (wasModified) {
    console.log(`[PromptSanitizer] Modified prompt, removed terms: ${removedTerms.join(', ')}`);
  }
  
  let result = sanitized;
  result = result.replace(/CFO|CEO|CTO|CMO|COO/gi, 'executive');
  result = result.replace(/ROI|KPI/gi, 'metrics');
  result = result.replace(/chargeback(s)?/gi, 'transaction');
  result = result.replace(/decline(s|d)?/gi, 'decision');
  result = result.replace(/false positive(s)?/gi, 'result');
  result = result.replace(/outdated|legacy/gi, 'traditional');
  result = result.replace(/draining|drain/gi, 'using');
  result = result.replace(/cost(s|ing)?/gi, 'investment');
  result = result.replace(/expensive/gi, 'significant');
  result = result.replace(/cheap/gi, 'affordable');
  result = result.replace(/failing|fail(s|ed)?/gi, 'changing');
  result = result.replace(/problem(s|atic)?/gi, 'situation');
  result = result.replace(/issue(s)?/gi, 'topic');
  result = result.replace(/challenge(s)?/gi, 'opportunity');
  result = result.replace(/obstacle(s)?/gi, 'consideration');
  result = result.replace(/barrier(s)?/gi, 'factor');
  result = result.replace(/negative/gi, 'different');
  result = result.replace(/bad/gi, 'previous');
  result = result.replace(/worst/gi, 'notable');
  result = result.replace(/terrible/gi, 'significant');
  result = result.replace(/horrible/gi, 'remarkable');
  
  result = result
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  if (!result.toLowerCase().includes('professional') && 
      !result.toLowerCase().includes('corporate') &&
      !result.toLowerCase().includes('business')) {
    result = `Professional business scene: ${result}`;
  }
  
  return result;
}

export function generateSafeRetryPrompt(originalPrompt: string, errorMessage?: string): string {
  const base = sanitizeForVeo(originalPrompt);
  
  const safeAdditions = [
    'Smooth dolly shot in modern office environment',
    'Clean geometric graphics with soft color gradients',
    'Professional presenter gesturing at data visualization',
    'Abstract flowing shapes representing business growth',
    'Cinematic overhead view of modern workspace',
    'Soft focus on hands typing on laptop keyboard',
    'Time-lapse of city skyline transitioning day to night',
    'Gentle camera pan across minimalist desk setup',
  ];
  
  const randomAddition = safeAdditions[Math.floor(Math.random() * safeAdditions.length)];
  
  if (base.length < 50) {
    return `${base}. ${randomAddition}. High quality, 4K, cinematic lighting.`;
  }
  
  return `${base}. High quality, cinematic lighting.`;
}
