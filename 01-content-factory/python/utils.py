"""
Shared utilities for Content Factory
"""
import os
import re
import json
from typing import Any, Optional


def extract_json_array(text: str) -> str:
    """Extract JSON array from response text"""
    start = text.find("[")
    end = text.rfind("]") + 1
    if start != -1 and end > start:
        json_str = text[start:end]
        json.loads(json_str)
        return json_str
    raise ValueError("No valid JSON array found in response")


def extract_json_object(text: str) -> str:
    """Extract JSON object from response text"""
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        json_str = text[start:end]
        json.loads(json_str)
        return json_str
    raise ValueError("No valid JSON object found in response")


def safe_extract_json(text: str, expect_array: bool = False) -> Any:
    """
    Safely extract and parse JSON from LLM text responses.
    
    Handles common LLM output patterns:
    - Plain JSON (just brackets)
    - JSON with leading/trailing text
    - JSON in fenced code blocks
    - Markdown-wrapped JSON
    """
    if not text or not text.strip():
        raise ValueError("Empty response text")
    
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    code_block = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if code_block:
        try:
            return json.loads(code_block.group(1).strip())
        except json.JSONDecodeError:
            pass
    
    try:
        if expect_array:
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end > start:
                json_str = text[start:end + 1]
                return json.loads(json_str)
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end > start:
                json_str = text[start:end + 1]
                return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if expect_array and line.strip().startswith('['):
            try:
                remaining = '\n'.join(lines[i:])
                end_idx = remaining.rfind(']')
                if end_idx != -1:
                    return json.loads(remaining[:end_idx + 1])
            except json.JSONDecodeError:
                continue
        elif not expect_array and line.strip().startswith('{'):
            try:
                remaining = '\n'.join(lines[i:])
                end_idx = remaining.rfind('}')
                if end_idx != -1:
                    return json.loads(remaining[:end_idx + 1])
            except json.JSONDecodeError:
                continue
    
    raise ValueError(f"Failed to extract JSON from response. Text starts with: {text[:200]}...")


def validate_env_var(key: str, required: bool = True) -> Optional[str]:
    """Validate and retrieve environment variable"""
    value = os.environ.get(key)
    if required and not value:
        raise ValueError(f"Required environment variable {key} is not set")
    return value


def check_api_keys() -> dict:
    """Check which API keys are available"""
    keys = {
        "anthropic": bool(os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY")),
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "elevenlabs": bool(os.environ.get("ELEVENLABS_API_KEY")),
        "runway": bool(os.environ.get("RUNWAY_API_KEY")),
        "pika": bool(os.environ.get("PIKA_API_KEY")),
        "midjourney": bool(os.environ.get("MIDJOURNEY_API_KEY")),
        "flux": bool(os.environ.get("FLUX_API_KEY")),
        "replicate": bool(os.environ.get("REPLICATE_API_KEY")),
        "slack": bool(os.environ.get("SLACK_WEBHOOK_URL")),
        "buffer": bool(os.environ.get("BUFFER_ACCESS_TOKEN")),
    }
    return keys


def truncate_text(text: str, max_length: int = 200, suffix: str = "...") -> str:
    """Truncate text to max length with suffix"""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix
