import { db } from "../server/db";
import { clients } from "../shared/schema";
import { eq } from "drizzle-orm";
import type { BrandProfileJSON } from "../shared/schema";

const shieldFinanceBrandProfile: BrandProfileJSON = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  textual: {
    brandName: {
      primary: "Shield Finance",
      token: "$SHLD",
      abbreviation: "SHLD",
      usageNotes: "Always capitalize Shield and Finance separately"
    },
    tagline: {
      primary: "Fortifying Your Digital Assets",
      alternatives: [
        "Security-First DeFi",
        "Next-Generation Asset Protection",
        "Defend Your Wealth in Web3",
      ],
      maxWords: 6
    },
    brandStory: {
      short: "Shield Finance is a next-generation DeFi protocol that prioritizes security without compromising yield. Built by security researchers and financial experts, we protect your digital assets with battle-tested smart contracts and innovative risk management.",
      medium: "In a landscape where DeFi exploits have cost users billions, Shield Finance emerged as the answer to crypto's security crisis. Founded by a team of former security auditors, white-hat hackers, and quantitative analysts, we've built a protocol that puts protection first while delivering competitive yields.",
      full: "In a landscape where DeFi exploits have cost users billions, Shield Finance emerged as the answer to crypto's security crisis. Founded by a team of former security auditors, white-hat hackers, and quantitative analysts, we've built a protocol that puts protection first. Our multi-layer security architecture includes real-time monitoring, automated circuit breakers, and insurance-backed protection. Every smart contract undergoes rigorous audits by leading security firms. We believe security and yield don't have to be mutually exclusive."
    },
    mission: "To make DeFi safe for everyone by building the most secure yield optimization protocol in crypto.",
    vision: "A world where decentralized finance is trusted by institutions and individuals alike.",
    values: [
      {
        name: "Security First",
        description: "Every line of code is audited. Every transaction is monitored."
      },
      {
        name: "Transparency",
        description: "Open-source code, public audits, and real-time dashboards."
      },
      {
        name: "Innovation",
        description: "Pushing the boundaries of DeFi security with cutting-edge technology."
      },
      {
        name: "Community",
        description: "Governed by token holders. Built for the community."
      },
    ],
    personality: {
      archetype: "The Guardian",
      traits: ["confident", "professional", "technical", "trustworthy", "innovative"],
      avoidTraits: ["casual", "humorous", "uncertain", "aggressive"]
    },
    tone: {
      description: "Confident, professional, and technically authoritative while remaining approachable",
      formality: 75,
      energy: 60,
      technicality: 80,
      warmth: 45
    },
    forbiddenWords: [
      "guaranteed returns",
      "risk-free",
      "100% safe",
      "moon",
      "lambo",
      "get rich quick",
      "ape",
      "degen"
    ],
    keywords: [
      "DeFi security",
      "smart contract protection",
      "yield optimization",
      "risk management",
      "decentralized finance",
      "crypto security",
      "protocol safety",
      "audited contracts"
    ],
    contentGoals: [
      "Build trust and demonstrate security expertise",
      "Attract high-value depositors",
      "Establish thought leadership in DeFi security",
      "Educate users on security best practices"
    ],
    pastSuccesses: [
      "Zero security incidents since launch",
      "Over $500M in TVL protected",
      "3 successful security audits from top firms"
    ],
    examplePhrases: [
      "Your assets, fortified.",
      "Security without compromise.",
      "Built by security experts, for serious investors.",
      "Where protection meets performance.",
      "DeFi, defended."
    ],
    callToActions: [
      "Start Securing Your Assets",
      "Explore Shield Protocol",
      "Join the Shield Community",
      "View Security Audits"
    ],
    targetAudience: {
      demographics: "Crypto-native investors aged 25-55 with significant portfolio holdings",
      psychographics: "Security-conscious, risk-aware individuals who prioritize capital preservation while seeking competitive yields",
      painPoints: [
        "Fear of smart contract exploits",
        "Lack of transparency in DeFi protocols",
        "Difficulty assessing protocol security",
        "Concern about impermanent loss"
      ],
      goals: [
        "Earn yield safely",
        "Protect crypto holdings",
        "Understand protocol risks",
        "Participate in governance"
      ]
    }
  },
  visual: {
    visualStyle: {
      description: "Futuristic cybersecurity aesthetic with clean lines and holographic accents",
      aesthetic: ["cyberpunk", "minimalist", "futuristic", "professional", "high-tech"],
      moodKeywords: ["secure", "powerful", "innovative", "trustworthy", "cutting-edge"],
      patterns: ["hexagonal grids", "circuit traces", "shield motifs"],
      motifs: ["shields", "locks", "holographic overlays", "data streams"]
    },
    colorPalette: {
      darkMode: {
        background: { name: "Deep Space", hex: "#0A0F1A", usage: "Primary background for all dark mode interfaces" },
        accent: { name: "Electric Blue", hex: "#0066FF", usage: "Primary brand color for CTAs and highlights" },
        textPrimary: { name: "Pure White", hex: "#FFFFFF", usage: "Main text color" },
        textSecondary: { name: "Muted Gray", hex: "#8B95A8", usage: "Secondary text and labels" },
        success: { name: "Secure Green", hex: "#00FF88", usage: "Success states and positive indicators" },
        warning: { name: "Alert Amber", hex: "#FFB800", usage: "Warning states and cautions" },
        error: { name: "Danger Red", hex: "#FF4757", usage: "Error states and critical alerts" }
      },
      lightMode: {
        background: { name: "Light Gray", hex: "#F4F5F7", usage: "Primary background for light mode" },
        accent: { name: "Royal Blue", hex: "#0052CC", usage: "Primary brand color for CTAs" },
        textPrimary: { name: "Dark Navy", hex: "#172B4D", usage: "Main text color" }
      },
      additionalColors: [
        { name: "Shield Teal", hex: "#00D4AA", usage: "Secondary accent for data visualization" },
        { name: "Protocol Purple", hex: "#7B61FF", usage: "Tertiary accent for premium features" },
        { name: "Dark Surface", hex: "#141B2D", usage: "Card backgrounds and elevated surfaces" }
      ]
    },
    typography: {
      fonts: [
        {
          family: "Inter",
          category: "sans-serif",
          weights: [400, 500, 600, 700],
          usage: "Primary font for UI and body text",
          googleFontsUrl: "https://fonts.google.com/specimen/Inter"
        },
        {
          family: "JetBrains Mono",
          category: "monospace",
          weights: [400, 500, 600],
          usage: "Monospace for code, addresses, and technical content",
          googleFontsUrl: "https://fonts.google.com/specimen/JetBrains+Mono"
        }
      ]
    },
    iconography: {
      style: "Linear with 2px stroke",
      cornerStyle: "rounded",
      shape: "shield-inspired geometric",
      colorApproach: "Monochrome with accent highlights on hover",
      sizeBase: 24
    },
    cinematicGuidelines: {
      aspectRatio: "16:9",
      resolution: "4K",
      duration: { short: 15, medium: 30, long: 60 },
      pacing: "measured",
      motionStyle: "Smooth, professional with subtle tech glitch effects",
      transitionStyle: "Clean fades with digital dissolves",
      soundtrackStyle: "Electronic ambient with deep bass undertones",
      colorGrading: "High contrast, deep blacks, vibrant blues, slight cyan lift in shadows"
    },
    accessibility: {
      standard: "WCAG 2.1 AA",
      minContrastRatio: 4.5,
      altTextRequired: true
    },
    usageRules: {
      dos: [
        "Use Electric Blue as the primary accent color",
        "Maintain dark mode as the default interface",
        "Use Inter for all UI text",
        "Include subtle glow effects on interactive elements",
        "Use shield iconography to reinforce security messaging"
      ],
      donts: [
        "Never use bright colors without sufficient contrast",
        "Avoid cluttered layouts - maintain clean, minimal design",
        "Don't use casual or playful imagery",
        "Never compromise readability for aesthetics",
        "Avoid using competitor brand colors"
      ]
    }
  },
  referenceAssets: {
    logos: [],
    icons: [],
    moodBoards: []
  }
};

async function seedShieldFinance() {
  console.log("Seeding Shield Finance client...");

  try {
    const existing = await db.select().from(clients).where(eq(clients.name, "Shield Finance"));

    if (existing.length > 0) {
      console.log("Shield Finance client already exists, updating brand profile...");
      await db.update(clients)
        .set({ brandProfile: shieldFinanceBrandProfile })
        .where(eq(clients.name, "Shield Finance"));
      console.log("Shield Finance brand profile updated!");
    } else {
      console.log("Creating Shield Finance client...");
      await db.insert(clients).values({
        name: "Shield Finance",
        industry: "DeFi / Cryptocurrency",
        brandVoice: "Confident, technical, trustworthy",
        targetAudience: "DeFi investors, yield farmers, security-conscious crypto users",
        keywords: "DeFi security, smart contract protection, yield optimization, risk management",
        contentGoals: "Build trust, demonstrate security expertise, attract high-value depositors",
        isActive: true,
        brandProfile: shieldFinanceBrandProfile,
        websiteUrl: "https://shield.finance",
        socialHandles: {
          twitter: "@ShieldFinance",
          discord: "discord.gg/shieldfinance",
          telegram: "t.me/shieldfinance"
        }
      });
      console.log("Shield Finance client created successfully!");
    }
  } catch (error) {
    console.error("Error seeding Shield Finance:", error);
    throw error;
  }
}

seedShieldFinance()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
