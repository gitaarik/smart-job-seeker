"""
Login Mixin for Browser Controller.

Provides methods for AI-powered login via Browser-Use agent.
"""

import time
import logging
from typing import TYPE_CHECKING

from browser_use import Agent, Browser

from chrome_manager import ChromeManager
from detection import (
    is_captcha_page,
    detect_verification_required,
    is_on_success_page,
    check_agent_result_for_captcha,
    check_agent_result_for_verification,
    check_agent_result_for_success,
)

if TYPE_CHECKING:
    from ..base import BrowserController

logger = logging.getLogger(__name__)


class LoginMixin:
    """Mixin providing AI-powered login methods."""

    async def login(
        self: "BrowserController",
        task: str,
        start_url: str,
        cdp_port: int = 9222,
        max_time: int = 120,
        use_vision: bool = True,
        solve_captcha: bool = False,
    ):
        """
        Perform AI-powered login: launch Chrome with CDP, execute login task, keep browser open.

        Args:
            task: Natural language login task
            start_url: URL to start from (login page)
            cdp_port: Port for CDP (default 9222)
            max_time: Maximum execution time in seconds
            use_vision: Whether to enable visual mode (screenshots) for LLM
            solve_captcha: If True, Browser-Use attempts to solve CAPTCHAs

        Returns:
            dict with 'login_success', 'current_url', 'cdp_port', etc.
        """
        start_time = time.time()

        logger.info(f"[Browser-Use] Starting login session with CDP on port {cdp_port}")
        print(
            f"[Browser-Use] Starting login session with CDP on port {cdp_port}",
            flush=True,
        )

        vision_enabled = use_vision and self.vision_support

        try:
            # Close any existing session
            await self.close()

            # Ensure Chrome has exactly one blank tab
            # Browser-use will handle navigation via the task prompt
            cdp_url = await ChromeManager.ensure_single_blank_tab(cdp_port)

            # Connect browser-use to Chrome via CDP
            # Use keep_alive=True to prevent browser-use from closing Chrome when agent finishes
            browser = Browser(cdp_url=cdp_url, keep_alive=True)
            # Store reference to keep browser alive after agent completes
            self._active_browser = browser

            # Create and run the agent
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=vision_enabled,
            )

            result = await agent.run()
            execution_time = int((time.time() - start_time) * 1000)

            # Verify Chrome is still responsive
            current_url = await ChromeManager.get_current_url(cdp_port)
            if not current_url:
                raise RuntimeError("Chrome CDP became unresponsive after login")

            logger.info(f"[Browser-Use] Current URL: {current_url}")

            # Check for CAPTCHA (agent reported)
            if check_agent_result_for_captcha(result):
                return {
                    "success": False,
                    "login_success": False,
                    "captcha_needed": True,
                    "verification_needed": False,
                    "current_url": current_url,
                    "cdp_port": cdp_port,
                    "execution_time_ms": execution_time,
                }

            # Check page content for CAPTCHA or verification
            page_text = await ChromeManager.get_page_text(cdp_port)

            if page_text:
                # Check for CAPTCHA page
                if is_captcha_page(page_text):
                    if solve_captcha:
                        logger.info(
                            "[Browser-Use] Detected CAPTCHA - agent will attempt to solve"
                        )
                    else:
                        logger.info(
                            "[Browser-Use] Detected CAPTCHA - manual intervention required"
                        )
                        return {
                            "success": False,
                            "login_success": False,
                            "captcha_needed": True,
                            "verification_needed": False,
                            "current_url": current_url,
                            "cdp_port": cdp_port,
                            "execution_time_ms": execution_time,
                        }
                else:
                    # Check for verification code requirement
                    verification_needed, vtype, prompt = detect_verification_required(
                        page_text
                    )

                    if verification_needed:
                        logger.info(f"[Browser-Use] Verification needed: {vtype}")
                        return {
                            "login_success": False,
                            "captcha_needed": False,
                            "verification_needed": True,
                            "verification_type": vtype,
                            "verification_prompt": prompt,
                            "current_url": current_url,
                            "cdp_port": cdp_port,
                            "execution_time_ms": execution_time,
                        }

            # Check if agent reported verification needed
            if check_agent_result_for_verification(result):
                return {
                    "login_success": False,
                    "captcha_needed": False,
                    "verification_needed": True,
                    "verification_type": "code",
                    "verification_prompt": "Please enter the verification code",
                    "current_url": current_url,
                    "cdp_port": cdp_port,
                    "execution_time_ms": execution_time,
                }

            # Determine success
            login_success = is_on_success_page(
                current_url
            ) or check_agent_result_for_success(result)

            logger.info(f"[Browser-Use] Login complete - success: {login_success}")
            print(
                f"[Browser-Use] Browser kept open on CDP port {cdp_port}", flush=True
            )

            return {
                "login_success": login_success,
                "captcha_needed": False,
                "verification_needed": False,
                "current_url": current_url,
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            logger.error(f"[Browser-Use] Login session error: {error_str}")
            await self.close()

            return {
                "login_success": False,
                "captcha_needed": False,
                "verification_needed": False,
                "current_url": "",
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
                "error": error_str,
            }
