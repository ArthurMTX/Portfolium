"""
Email translation utilities for Portfolium

This module provides functions to load email translations from the frontend
translation JSON files, ensuring a single source of truth for all translations.
"""
import json
import os
from pathlib import Path
from typing import Dict, Any


def get_translation_file_path(language: str) -> Path:
    """Get the path to the translation JSON file for a given language"""
    # First, try Docker/production path (locales copied to /app/locales)
    docker_path = Path("/app/locales") / language / "translation.json"
    if docker_path.exists():
        return docker_path
    
    # Second, try development path (relative to api directory)
    api_root = Path(__file__).parent.parent.parent
    dev_path = api_root / "locales" / language / "translation.json"
    if dev_path.exists():
        return dev_path
    
    # Third, try web directory path (for local development)
    project_root = Path(__file__).parent.parent.parent.parent
    web_path = project_root / "web" / "src" / "locales" / language / "translation.json"
    if web_path.exists():
        return web_path
    
    # Fallback to English if language file doesn't exist
    if language != 'en':
        return get_translation_file_path('en')
    
    raise FileNotFoundError(f"Translation file not found for language: {language}")


def load_translations(language: str = 'en') -> Dict[str, Any]:
    """Load translations from JSON file"""
    translation_path = get_translation_file_path(language)
    
    try:
        with open(translation_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        # Fallback to English on any error
        if language != 'en':
            return load_translations('en')
        raise e


def get_email_translation(language: str, email_type: str, key: str) -> str:
    """
    Get a specific email translation
    
    Args:
        language: Language code (e.g., 'en', 'fr')
        email_type: Email type (e.g., 'verification', 'passwordReset', 'welcome', 'dailyReport')
        key: Translation key
    
    Returns:
        Translated string
    """
    translations = load_translations(language)
    email_translations = translations.get('emails', {}).get(email_type, {})
    return email_translations.get(key, '')


def get_all_translations(language: str, email_type: str) -> Dict[str, str]:
    """
    Get all translations for a specific email type
    
    Converts i18next-style placeholders ({{variable}}) to Python format placeholders ({variable})
    for use with .format()
    
    Args:
        language: Language code (e.g., 'en', 'fr')
        email_type: Email type (e.g., 'verification', 'passwordReset', 'welcome', 'dailyReport')
    
    Returns:
        Dictionary of all translations for the email type with converted placeholders
    """
    translations = load_translations(language)
    emails = translations.get('emails', {})
    
    # Get common translations
    common_translations = emails.get('common', {})
    
    # Get specific email type translations
    email_translations = emails.get(email_type, {})
    
    # Convert i18next placeholders {{var}} to Python format placeholders {var}
    converted = {}
    
    # First add common translations
    for key, value in common_translations.items():
        if isinstance(value, str):
            converted[key] = value.replace('{{', '{').replace('}}', '}')
        else:
            converted[key] = value
    
    # Then add email-specific translations (these override common if there are duplicates)
    for key, value in email_translations.items():
        if isinstance(value, str):
            converted[key] = value.replace('{{', '{').replace('}}', '}')
        else:
            converted[key] = value
    
    return converted
