"""
Brand Voice Database - Sample data seeder
Uses PostgreSQL via the same DATABASE_URL as the main app
"""
import os
from typing import List, Optional
from .models import BrandVoice


SAMPLE_BRAND_VOICES: List[BrandVoice] = [
    BrandVoice(
        client_id="nexus_corp",
        client_name="Nexus Corp",
        industry="Enterprise SaaS",
        tone="Professional, innovative, results-driven. We speak to CTOs and tech leaders who need scalable solutions.",
        forbidden_words=["cheap", "easy", "simple", "basic", "just"],
        target_audience="CTOs, VPs of Engineering, and technical decision-makers at companies with 500+ employees",
        keywords=["enterprise software", "digital transformation", "cloud infrastructure", "API integration", "scalability"],
        content_goals=["Generate qualified leads", "establish thought leadership", "drive demo requests"],
        past_winners=[
            "5 Signs Your Legacy System Is Holding You Back",
            "The CTO's Guide to Cloud Migration",
            "Why Fortune 500 Companies Are Switching to API-First Architecture"
        ],
        examples=[
            "Transform your infrastructure, not your budget.",
            "Enterprise-grade reliability. Startup-speed innovation."
        ]
    ),
    BrandVoice(
        client_id="stellar_dynamics",
        client_name="Stellar Dynamics",
        industry="FinTech",
        tone="Trustworthy, modern, secure. We help financial institutions embrace the future while maintaining compliance.",
        forbidden_words=["risky", "cheap", "hack", "loophole"],
        target_audience="CFOs, Finance Directors, and compliance officers at mid-size financial companies",
        keywords=["fintech", "payment processing", "fraud prevention", "regulatory compliance", "digital banking"],
        content_goals=["Build trust", "educate on compliance", "drive free trial signups"],
        past_winners=[
            "How AI Is Revolutionizing Fraud Detection",
            "The CFO's Complete Guide to PCI DSS 4.0",
            "10 Payment Trends That Will Define 2025"
        ],
        examples=[
            "Security that doesn't slow you down.",
            "Compliance made simple. Growth made possible."
        ]
    ),
    BrandVoice(
        client_id="hyperloop_one",
        client_name="HyperLoop One",
        industry="E-commerce",
        tone="Bold, customer-obsessed, data-driven. We help brands scale their online presence with AI-powered insights.",
        forbidden_words=["might", "perhaps", "traditional", "old-fashioned"],
        target_audience="E-commerce managers, DTC brand founders, and marketing directors",
        keywords=["e-commerce optimization", "conversion rate", "customer analytics", "personalization", "AI recommendations"],
        content_goals=["Drive platform signups", "increase engagement", "showcase case studies"],
        past_winners=[
            "How We Helped a DTC Brand 10x Their Revenue in 6 Months",
            "The Death of One-Size-Fits-All E-commerce",
            "AI Personalization: Your Secret Weapon for 2025"
        ],
        examples=[
            "Every customer is unique. Your store should know that.",
            "Data-driven growth for the brands that are changing everything."
        ]
    ),
    BrandVoice(
        client_id="quantum_leap",
        client_name="Quantum Leap",
        industry="AI/ML Services",
        tone="Cutting-edge, accessible, transformative. We make enterprise AI achievable for growing companies.",
        forbidden_words=["magic", "black box", "complicated", "expensive"],
        target_audience="Startup founders, product managers, and innovation leads exploring AI integration",
        keywords=["machine learning", "AI implementation", "predictive analytics", "automation", "custom AI models"],
        content_goals=["Book strategy calls", "demonstrate expertise", "build community"],
        past_winners=[
            "You Don't Need a Data Science Team to Use AI",
            "The $500K AI Project That Should Have Cost $50K",
            "Build vs. Buy: The AI Decision Framework"
        ],
        examples=[
            "Enterprise AI without the enterprise budget.",
            "From prototype to production in weeks, not years."
        ]
    ),
    BrandVoice(
        client_id="oasis_systems",
        client_name="Oasis Systems",
        industry="Healthcare Tech",
        tone="Compassionate, secure, compliant. We put patient outcomes first while enabling healthcare innovation.",
        forbidden_words=["experimental", "untested", "disrupt", "revolutionize"],
        target_audience="Healthcare administrators, clinic owners, and health IT directors",
        keywords=["HIPAA compliance", "patient portal", "telehealth", "EHR integration", "healthcare automation"],
        content_goals=["Drive demo requests", "build credibility", "educate on compliance benefits"],
        past_winners=[
            "How Telehealth Reduced No-Shows by 60%",
            "The Complete HIPAA Compliance Checklist for 2025",
            "Why Patients Love Self-Service Portals (And Providers Do Too)"
        ],
        examples=[
            "Healthier patients. Happier staff. Better outcomes.",
            "Technology that cares as much as you do."
        ]
    ),
]


class BrandVoiceDB:
    """Simple in-memory brand voice database with PostgreSQL sync option"""
    
    def __init__(self):
        self._voices: dict[str, BrandVoice] = {
            v.client_id: v for v in SAMPLE_BRAND_VOICES
        }
    
    def get(self, client_id: str) -> Optional[BrandVoice]:
        """Get brand voice by client ID"""
        return self._voices.get(client_id)
    
    def get_by_name(self, client_name: str) -> Optional[BrandVoice]:
        """Get brand voice by client name"""
        for voice in self._voices.values():
            if voice.client_name.lower() == client_name.lower():
                return voice
        return None
    
    def list_all(self) -> List[BrandVoice]:
        """List all brand voices"""
        return list(self._voices.values())
    
    def add(self, voice: BrandVoice) -> None:
        """Add or update a brand voice"""
        self._voices[voice.client_id] = voice
    
    def delete(self, client_id: str) -> bool:
        """Delete a brand voice"""
        if client_id in self._voices:
            del self._voices[client_id]
            return True
        return False


brand_voice_db = BrandVoiceDB()
