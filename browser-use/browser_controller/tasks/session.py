"""
Session Management Mixin for Browser Controller.

Provides methods for checking and managing persistent browser sessions.
"""

import time
import asyncio
import logging
from typing import TYPE_CHECKING

from chrome_manager import ChromeManager

if TYPE_CHECKING:
    from ..base import BrowserController

logger = logging.getLogger(__name__)


class SessionMixin:
    """Mixin providing session management methods."""

    async def check_session(
        self: "BrowserController",
        check_url: str,
        login_url_pattern: str,
        cdp_port: int = 9222,
    ) -> dict:
        """
        Check if the persistent session is logged in.

        Launches Chrome with existing session, navigates to check_url,
        and determines if user is logged in based on URL pattern.
        """
        session_exists = ChromeManager.session_exists()

        if not session_exists:
            return {
                "session_exists": False,
                "is_logged_in": False,
                "current_url": "",
                "cdp_port": cdp_port,
            }

        # Clean up any extra tabs first
        await ChromeManager.close_extra_tabs(cdp_port)

        # Launch browser with existing session
        await ChromeManager.navigate(check_url, cdp_port)

        # Wait for page to load
        await asyncio.sleep(3)

        current_url = await ChromeManager.get_current_url(cdp_port)
        is_logged_in = login_url_pattern.lower() not in current_url.lower()

        return {
            "session_exists": True,
            "is_logged_in": is_logged_in,
            "current_url": current_url,
            "cdp_port": cdp_port,
        }

    async def start_session(
        self: "BrowserController",
        start_url: str,
        cdp_port: int = 9222,
    ) -> dict:
        """
        Start browser with existing persistent session (no login attempt).
        """
        # Clean up any extra tabs first
        await ChromeManager.close_extra_tabs(cdp_port)

        await ChromeManager.navigate(start_url, cdp_port)
        current_url = await ChromeManager.get_current_url(cdp_port)

        return {
            "success": True,
            "current_url": current_url,
            "cdp_port": cdp_port,
            "vnc_url": "localhost:5900",
        }

    async def wait_for_login(
        self: "BrowserController",
        target_url_pattern: str,
        cdp_port: int = 9222,
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> dict:
        """
        Wait for manual login completion by polling the current URL.
        """
        start_time = time.time()
        current_url = ""

        while (time.time() - start_time) < timeout:
            current_url = await ChromeManager.get_current_url(cdp_port)

            if target_url_pattern.lower() in current_url.lower():
                return {
                    "success": True,
                    "current_url": current_url,
                    "timed_out": False,
                }

            await asyncio.sleep(poll_interval)

        return {
            "success": False,
            "current_url": current_url,
            "timed_out": True,
        }

    async def navigate_to(
        self: "BrowserController",
        url: str,
        cdp_port: int = 9222,
    ) -> dict:
        """
        Navigate to a URL and return the current URL and page text.

        Useful for login state detection - navigate to login page and check
        if redirected and what content is on the page.
        """
        # Clean up any extra tabs first
        await ChromeManager.close_extra_tabs(cdp_port)

        # Navigate to URL
        await ChromeManager.navigate(url, cdp_port)

        # Wait for page to load
        await asyncio.sleep(3)

        # Get current URL (may have been redirected)
        current_url = await ChromeManager.get_current_url(cdp_port)

        # Get page text content
        page_text = await ChromeManager.get_page_text(cdp_port)

        return {
            "success": True,
            "current_url": current_url,
            "page_text": page_text,
            "cdp_port": cdp_port,
        }

    async def close(self: "BrowserController"):
        """Close the browser session."""
        # Clear browser reference to allow cleanup
        self._active_browser = None
        await ChromeManager.close()
        return {"closed": True}
