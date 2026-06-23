/**
 * Content-finishing helpers — the Acc-readiness layer that runs AFTER the
 * LLM produces a draft: compliance gating, regulatory footers, and
 * bilingual (EN+AR) fan-out.
 *
 * Kept out of the monolithic generate-single handler so it's testable and
 * reusable by the future batch endpoint.
 */
import type { Client } from "@shared/schema";

export type Locale = "en" | "ar";

export interface ComplianceGateResult {
  ok: boolean;
  reason?: string;
}

/**
 * Hard gate for regulated verticals. Real-estate content must not be
 * generated without the regulator's permit numbers — Dubai DLD/RERA, KSA
 * REGA. Returns ok:false to be turned into an HTTP 422 rejected_compliance.
 */
export function complianceGate(client: Client): ComplianceGateResult {
  if (client.vertical !== "real_estate") return { ok: true };

  const c = client.brandProfile?.compliance;
  const missing: string[] = [];
  if (!c?.rera) missing.push("RERA/REGA permit");
  if (!c?.dld) missing.push("DLD registration");
  if (!c?.brokerLicense) missing.push("broker license");

  if (missing.length) {
    return {
      ok: false,
      reason: `Real-estate content requires compliance details before generation. Missing: ${missing.join(", ")}. Add them in Brand → Guidelines.`,
    };
  }
  return { ok: true };
}

/**
 * The localized regulatory footer for a client+locale. Prefers an explicit
 * mandatory footer string; otherwise assembles one from the permit numbers.
 * Returns "" when the client has no compliance profile (non-regulated).
 */
export function complianceFooter(client: Client, locale: Locale): string {
  const c = client.brandProfile?.compliance;
  if (!c) return "";

  if (locale === "ar" && c.mandatoryFooterAr) return c.mandatoryFooterAr;
  if (locale === "en" && c.mandatoryFooterEn) return c.mandatoryFooterEn;

  const parts: string[] = [];
  if (c.rera) parts.push(locale === "ar" ? `رقم تصريح: ${c.rera}` : `Permit No: ${c.rera}`);
  if (c.dld) parts.push(locale === "ar" ? `تسجيل دائرة الأراضي: ${c.dld}` : `DLD Reg: ${c.dld}`);
  if (c.brokerLicense) parts.push(locale === "ar" ? `رخصة الوسيط: ${c.brokerLicense}` : `Broker Lic: ${c.brokerLicense}`);
  return parts.join(" · ");
}

/** Append the footer to content if present and not already there. */
export function withComplianceFooter(content: string, footer: string): string {
  if (!footer || content.includes(footer)) return content;
  return `${content}\n\n—\n${footer}`;
}

/** Output locales for a client. Defaults to English-only. */
export function resolveLocales(client: Client): Locale[] {
  const locales = client.brandProfile?.textual?.outputLocales;
  if (locales && locales.length) return locales;
  return ["en"];
}

/**
 * Translate finished content to Arabic (MSA by default). Uses the existing
 * multi-provider text fallback with an Arabic-pinned system prompt. Returns
 * the original content unchanged if translation fails (fail-open — better a
 * second English row than a dropped variant; the operator sees it in review).
 */
export async function translateToArabic(content: string, client: Client): Promise<string> {
  const guidelines = client.brandProfile?.textual?.arabicGuidelines;
  const dialect = guidelines?.dialect ?? "MSA";
  const toneLine = guidelines?.tone ? ` Tone: ${guidelines.tone}.` : "";
  const forbidden = guidelines?.forbiddenTransliterations?.length
    ? ` Do NOT transliterate these to Arabic letters; keep them in Latin script: ${guidelines.forbiddenTransliterations.join(", ")}.`
    : "";

  const systemPrompt =
    `You are a professional Arabic copywriter. Translate the user's marketing content into ${dialect === "khaleeji" ? "Khaleeji (Gulf) Arabic" : "Modern Standard Arabic (MSA)"}.` +
    ` Preserve meaning, brand voice, and any call-to-action.${toneLine}${forbidden}` +
    ` Return ONLY the translated text — no preamble, no notes, no Latin-script explanation.`;

  try {
    const { generateTextWithFallback } = await import(
      "../../01-content-factory/services/text-generation"
    );
    const result = await generateTextWithFallback(content, {
      systemPrompt,
      maxTokens: 4000,
    });
    if (result.success && result.content) return result.content.trim();
  } catch (err) {
    console.error("[content-finishing] Arabic translation failed:", err);
  }
  return content;
}
