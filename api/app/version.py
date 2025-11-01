"""
Version information for Portfolium API
This file can be updated automatically by CI/CD
"""

__version__ = "0.1.1"
__build_date__ = "2025-11-01"
__git_commit__ = "local"

def get_version_info() -> dict:
    """Get complete version information"""
    return {
        "version": __version__,
        "build_date": __build_date__,
        "git_commit": __git_commit__,
    }
