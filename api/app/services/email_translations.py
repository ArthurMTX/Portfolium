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
    # Get the project root (assumes api/ is at project root)
    project_root = Path(__file__).parent.parent.parent.parent
    translation_path = project_root / "web" / "src" / "locales" / language / "translation.json"
    
    if not translation_path.exists():
        # Fallback to English if language file doesn't exist
        translation_path = project_root / "web" / "src" / "locales" / "en" / "translation.json"
    
    return translation_path


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
    
    Args:
        language: Language code (e.g., 'en', 'fr')
        email_type: Email type (e.g., 'verification', 'passwordReset', 'welcome', 'dailyReport')
    
    Returns:
        Dictionary of all translations for the email type
    """
    translations = load_translations(language)
    return translations.get('emails', {}).get(email_type, {})
