/**
 * Content archetype registry — the menu of "what kind of content" an
 * operator can brief, keyed by client vertical. Single source of truth for
 * both the Brief Composer (client/src/components/brief-composer.tsx) and the
 * generation pipeline (01-content-factory).
 *
 * Each archetype declares its narrative shape, default render provider, and
 * duration so the pipeline can storyboard without per-client config. Adding
 * a vertical = adding an entry here, no code changes elsewhere.
 */
export interface Archetype {
  key: string;
  label: string;
  description: string;
  /** scene count the storyboard node targets */
  scenes: number;
  /** total target duration in seconds */
  durationSec: number;
  /** preferred render provider (dual-path-router may override on budget) */
  providerPreference: "seedance_pro" | "seedance_lite" | "veo31" | "runway";
  /** voice/tone hint passed to the script agent */
  voiceTone: string;
}

export type Vertical = "real_estate" | "pools" | "generic";

export const ARCHETYPES: Record<Vertical, Archetype[]> = {
  real_estate: [
    {
      key: "property_reveal_60s",
      label: "Property Reveal (60s)",
      description: "Exterior → interior beats → CTA. Cinematic hero piece for a listing.",
      scenes: 5,
      durationSec: 60,
      providerPreference: "veo31",
      voiceTone: "aspirational, confident, data-grounded — no unsubstantiated claims",
    },
    {
      key: "agent_intro_15s",
      label: "Agent Intro (15s)",
      description: "Licensed broker intro + brand b-roll. Trust-building short.",
      scenes: 2,
      durationSec: 15,
      providerPreference: "seedance_lite",
      voiceTone: "warm, professional, credible",
    },
    {
      key: "neighborhood_lifestyle_30s",
      label: "Neighborhood Lifestyle (30s)",
      description: "Area amenities, transport, lifestyle shots around the development.",
      scenes: 3,
      durationSec: 30,
      providerPreference: "seedance_pro",
      voiceTone: "evocative, lifestyle-led",
    },
    {
      key: "price_drop_alert_15s",
      label: "Price-Drop Alert (15s)",
      description: "Punchy text-led card with property thumb. Substantiated price claims only.",
      scenes: 1,
      durationSec: 15,
      providerPreference: "seedance_lite",
      voiceTone: "urgent but compliant — price claims require an ad-license number",
    },
  ],
  pools: [
    {
      key: "before_after_30s",
      label: "Before / After (30s)",
      description: "Green-to-blue transformation reveal. J Pools' signature proof shot.",
      scenes: 3,
      durationSec: 30,
      providerPreference: "seedance_pro",
      voiceTone: "the Australian way — calm expertise, crystal-clear standards",
    },
    {
      key: "maintenance_tip_15s",
      label: "Maintenance Tip (15s)",
      description: "Single actionable pool-care tip. Educational, fast.",
      scenes: 2,
      durationSec: 15,
      providerPreference: "seedance_lite",
      voiceTone: "friendly expert, approachable",
    },
    {
      key: "install_timelapse_60s",
      label: "Install Timelapse (60s)",
      description: "Renovation/build sequence with milestone beats and CTA.",
      scenes: 5,
      durationSec: 60,
      providerPreference: "seedance_pro",
      voiceTone: "proud craftsmanship, local trust",
    },
  ],
  generic: [
    {
      key: "social_short_15s",
      label: "Social Short (15s)",
      description: "Generic short-form social clip for any brand.",
      scenes: 2,
      durationSec: 15,
      providerPreference: "seedance_lite",
      voiceTone: "on-brand per the client's brandProfile voice",
    },
    {
      key: "brand_story_30s",
      label: "Brand Story (30s)",
      description: "Three-beat brand narrative for any vertical.",
      scenes: 3,
      durationSec: 30,
      providerPreference: "seedance_pro",
      voiceTone: "on-brand per the client's brandProfile voice",
    },
  ],
};

/** Resolve a vertical string (possibly null/unknown) to its archetype list. */
export function archetypesForVertical(vertical?: string | null): Archetype[] {
  if (vertical && vertical in ARCHETYPES) {
    return ARCHETYPES[vertical as Vertical];
  }
  return ARCHETYPES.generic;
}
