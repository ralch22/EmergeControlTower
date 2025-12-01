"""
Brand Asset Validation Module
Validates brand assets for existence, format, file size, and extracts metadata.
"""

import os
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from pathlib import Path

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

MAX_FILE_SIZE_MB = 50
ALLOWED_IMAGE_FORMATS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
ALLOWED_VIDEO_FORMATS = {'mp4', 'mov', 'avi', 'webm'}
HEX_COLOR_PATTERN = re.compile(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')
RGB_COLOR_PATTERN = re.compile(r'^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$', re.IGNORECASE)


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


def validate_file_exists(path: str) -> Tuple[bool, str]:
    """Check if file exists at given path."""
    if path.startswith(('http://', 'https://')):
        return True, ""
    
    full_path = Path(path)
    if not full_path.exists():
        return False, f"File not found: {path}"
    if not full_path.is_file():
        return False, f"Path is not a file: {path}"
    return True, ""


def validate_file_size(path: str, max_size_mb: float = MAX_FILE_SIZE_MB) -> Tuple[bool, str]:
    """Check if file is under size limit."""
    if path.startswith(('http://', 'https://')):
        return True, ""
    
    try:
        size_mb = os.path.getsize(path) / (1024 * 1024)
        if size_mb > max_size_mb:
            return False, f"File exceeds {max_size_mb}MB limit ({size_mb:.2f}MB): {path}"
        return True, ""
    except OSError as e:
        return False, f"Error checking file size: {e}"


def validate_image_format(path: str) -> Tuple[bool, str]:
    """Check if file has valid image format."""
    ext = Path(path).suffix.lower().lstrip('.')
    if ext not in ALLOWED_IMAGE_FORMATS:
        return False, f"Invalid image format '{ext}'. Allowed: {', '.join(ALLOWED_IMAGE_FORMATS)}"
    return True, ""


def validate_video_format(path: str) -> Tuple[bool, str]:
    """Check if file has valid video format."""
    ext = Path(path).suffix.lower().lstrip('.')
    if ext not in ALLOWED_VIDEO_FORMATS:
        return False, f"Invalid video format '{ext}'. Allowed: {', '.join(ALLOWED_VIDEO_FORMATS)}"
    return True, ""


def get_image_metadata(path: str) -> Dict[str, Any]:
    """Extract image dimensions and format using Pillow."""
    if not PILLOW_AVAILABLE:
        return {"warning": "Pillow not available for image analysis"}
    
    if path.startswith(('http://', 'https://')):
        return {"type": "remote", "url": path}
    
    try:
        from PIL import Image as PILImage
        with PILImage.open(path) as img:
            return {
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "mode": img.mode,
                "aspect_ratio": round(img.width / img.height, 2) if img.height > 0 else 0
            }
    except Exception as e:
        return {"error": str(e)}


def extract_dominant_colors(path: str, num_colors: int = 5) -> List[str]:
    """Extract dominant colors from an image using Pillow."""
    if not PILLOW_AVAILABLE:
        return []
    
    if path.startswith(('http://', 'https://')):
        return []
    
    try:
        from PIL import Image as PILImage
        with PILImage.open(path) as img:
            rgb_img = img.convert('RGB')
            rgb_img.thumbnail((150, 150))
            
            pixels = [rgb_img.getpixel((x, y)) for x in range(rgb_img.width) for y in range(rgb_img.height)]
            color_counts: Dict[Tuple[int, int, int], int] = {}
            
            for pixel in pixels:
                r, g, b = pixel[0] // 32 * 32, pixel[1] // 32 * 32, pixel[2] // 32 * 32
                quantized = (r, g, b)
                color_counts[quantized] = color_counts.get(quantized, 0) + 1
            
            sorted_colors = sorted(color_counts.items(), key=lambda x: x[1], reverse=True)
            
            hex_colors = []
            for (r, g, b), _ in sorted_colors[:num_colors]:
                hex_colors.append(f"#{r:02x}{g:02x}{b:02x}")
            
            return hex_colors
    except Exception:
        return []


def validate_color(color: str) -> Tuple[bool, str]:
    """Validate a color string (hex or rgb format)."""
    color = color.strip()
    
    if HEX_COLOR_PATTERN.match(color):
        return True, ""
    
    rgb_match = RGB_COLOR_PATTERN.match(color)
    if rgb_match:
        r, g, b = int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3))
        if all(0 <= v <= 255 for v in (r, g, b)):
            return True, ""
        return False, f"Invalid RGB values (must be 0-255): {color}"
    
    known_colors = {
        'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
        'black', 'white', 'gray', 'grey', 'navy', 'teal', 'cyan',
        'magenta', 'brown', 'gold', 'silver', 'beige', 'coral'
    }
    if color.lower() in known_colors:
        return True, ""
    
    return False, f"Invalid color format: {color}. Use hex (#FF0000), rgb(255,0,0), or color name."


def validate_color_palette(colors: Optional[List[str]]) -> ValidationResult:
    """Validate a list of colors."""
    result = ValidationResult(valid=True)
    
    if not colors:
        return result
    
    validated_colors = []
    for color in colors:
        is_valid, error = validate_color(color)
        if not is_valid:
            result.errors.append(error)
            result.valid = False
        else:
            validated_colors.append(color)
    
    result.metadata["validated_colors"] = validated_colors
    return result


def validate_reference_assets(assets: Optional[Dict[str, str]]) -> ValidationResult:
    """Validate reference assets dictionary."""
    result = ValidationResult(valid=True)
    
    if not assets:
        return result
    
    validated_assets: Dict[str, Dict[str, Any]] = {}
    
    for name, path in assets.items():
        asset_info: Dict[str, Any] = {"path": path}
        
        exists, error = validate_file_exists(path)
        if not exists:
            result.errors.append(f"Asset '{name}': {error}")
            result.valid = False
            asset_info["status"] = "not_found"
            validated_assets[name] = asset_info
            continue
        
        if path.startswith(('http://', 'https://')):
            asset_info["status"] = "remote"
            asset_info["type"] = "url"
            validated_assets[name] = asset_info
            continue
        
        size_ok, size_error = validate_file_size(path)
        if not size_ok:
            result.errors.append(f"Asset '{name}': {size_error}")
            result.valid = False
            asset_info["status"] = "oversized"
            validated_assets[name] = asset_info
            continue
        
        ext = Path(path).suffix.lower().lstrip('.')
        
        if ext in ALLOWED_IMAGE_FORMATS:
            asset_info["type"] = "image"
            asset_info["metadata"] = get_image_metadata(path)
            if "logo" in name.lower():
                dominant = extract_dominant_colors(path, 3)
                if dominant:
                    asset_info["dominant_colors"] = dominant
        elif ext in ALLOWED_VIDEO_FORMATS:
            asset_info["type"] = "video"
        else:
            result.warnings.append(f"Asset '{name}': Unknown format '{ext}'")
            asset_info["type"] = "unknown"
        
        asset_info["status"] = "valid"
        validated_assets[name] = asset_info
    
    result.metadata["assets"] = validated_assets
    return result


def validate_brand_voice(brand_voice: dict) -> ValidationResult:
    """Validate complete brand voice configuration."""
    result = ValidationResult(valid=True)
    
    if color_palette := brand_voice.get("color_palette"):
        color_result = validate_color_palette(color_palette)
        result.errors.extend(color_result.errors)
        result.warnings.extend(color_result.warnings)
        if not color_result.valid:
            result.valid = False
        result.metadata["colors"] = color_result.metadata
    
    if ref_assets := brand_voice.get("reference_assets"):
        asset_result = validate_reference_assets(ref_assets)
        result.errors.extend(asset_result.errors)
        result.warnings.extend(asset_result.warnings)
        if not asset_result.valid:
            result.valid = False
        result.metadata["assets"] = asset_result.metadata
    
    if visual_style := brand_voice.get("visual_style"):
        if len(visual_style) < 10:
            result.warnings.append("Visual style description is very short. Consider adding more detail.")
        result.metadata["visual_style_length"] = len(visual_style)
    
    if cinematic := brand_voice.get("cinematic_guidelines"):
        if len(cinematic) < 20:
            result.warnings.append("Cinematic guidelines are brief. Consider adding aspect ratio, lighting, and music preferences.")
        result.metadata["cinematic_guidelines_length"] = len(cinematic)
    
    return result


def build_brand_prompt_context(brand_voice: dict) -> str:
    """Build a prompt context string from brand voice for AI content generation."""
    parts = []
    
    if visual_style := brand_voice.get("visual_style"):
        parts.append(f"Visual Style: {visual_style}")
    
    if colors := brand_voice.get("color_palette"):
        parts.append(f"Color Palette: {', '.join(colors)}")
    
    if fonts := brand_voice.get("fonts"):
        parts.append(f"Fonts: {', '.join(fonts)}")
    
    if cinematic := brand_voice.get("cinematic_guidelines"):
        parts.append(f"Cinematic Guidelines: {cinematic}")
    
    if ref_assets := brand_voice.get("reference_assets"):
        asset_names = list(ref_assets.keys())
        if asset_names:
            parts.append(f"Brand Assets Available: {', '.join(asset_names)}")
    
    if forbidden := brand_voice.get("forbidden_words", []):
        parts.append(f"Avoid: {', '.join(forbidden)}")
    
    return "\n".join(parts) if parts else ""
