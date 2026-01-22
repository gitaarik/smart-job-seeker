"""
Verification Mixin for Browser Controller.

Provides methods for handling verification codes during login.
"""

import time
import logging
from typing import TYPE_CHECKING

from browser_use import Agent, Browser

from chrome_manager import ChromeManager
from detection import is_on_success_page, parse_verification_result

if TYPE_CHECKING:
    from ..base import BrowserController

logger = logging.getLogger(__name__)


class VerificationMixin:
    """Mixin providing verification code methods."""

    async def submit_verification_code(
        self: "BrowserController",
        task: str,
        code: str,
        cdp_port: int = 9222,
        max_time: int = 60,
        use_vision: bool = True,
    ):
        """
        Submit a verification code and continue the login process.

        Args:
            task: Task prompt (with {{code}} already interpolated)
            code: The verification code to enter
            cdp_port: CDP port (default 9222)
            max_time: Maximum execution time in seconds
            use_vision: Whether to enable visual mode (screenshots) for LLM

        Returns:
            dict with 'success', 'login_complete', 'needs_new_code', etc.
        """
        start_time = time.time()
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info("[Browser-Use] Submitting verification code")
        print("[Browser-Use] Submitting verification code", flush=True)

        vision_enabled = use_vision and self.vision_support

        try:
            # Verify Chrome is still running
            if not await ChromeManager.is_cdp_ready(cdp_url):
                return {
                    "success": False,
                    "login_complete": False,
                    "needs_new_code": False,
                    "current_url": "",
                    "execution_time_ms": int((time.time() - start_time) * 1000),
                    "error": f"Chrome not running on CDP port {cdp_port}",
                }

            # Connect to Chrome via CDP
            browser = Browser(
                cdp_url=cdp_url,
                minimum_wait_page_load_time=1.0,
                wait_for_network_idle_page_load_time=2.0,
                wait_between_actions=1.0,
            )

            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=vision_enabled,
            )

            result = await agent.run()
            execution_time = int((time.time() - start_time) * 1000)

            current_url = await ChromeManager.get_current_url(cdp_port)

            # Parse result
            success, login_complete, needs_new_code, captcha_needed = (
                parse_verification_result(result)
            )

            # Also check URL for success indicators
            if current_url and is_on_success_page(current_url):
                success = True
                login_complete = True

            logger.info(
                f"[Browser-Use] Verification result: success={success}, "
                f"login_complete={login_complete}, needs_new_code={needs_new_code}"
            )

            return {
                "success": success,
                "login_complete": login_complete,
                "needs_new_code": needs_new_code,
                "captcha_needed": captcha_needed,
                "current_url": current_url,
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            logger.error(f"[Browser-Use] Verification error: {error_str}")

            return {
                "success": False,
                "login_complete": False,
                "needs_new_code": False,
                "captcha_needed": False,
                "current_url": "",
                "execution_time_ms": execution_time,
                "error": error_str,
            }

    async def resend_verification_code(
        self: "BrowserController",
        task: str,
        cdp_port: int = 9222,
        max_time: int = 30,
        use_vision: bool = True,
    ):
        """
        Click the 'resend code' button on the verification page.

        Args:
            task: Task prompt from database
            cdp_port: CDP port (default 9222)
            max_time: Maximum execution time in seconds
            use_vision: Whether to enable visual mode (screenshots) for LLM

        Returns:
            dict with 'success', 'error'
        """
        start_time = time.time()
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info("[Browser-Use] Requesting new verification code")
        print("[Browser-Use] Requesting new verification code", flush=True)

        vision_enabled = use_vision and self.vision_support

        try:
            # Verify Chrome is still running
            if not await ChromeManager.is_cdp_ready(cdp_url):
                return {
                    "success": False,
                    "execution_time_ms": int((time.time() - start_time) * 1000),
                    "error": f"Chrome not running on CDP port {cdp_port}",
                }

            browser = Browser(
                cdp_url=cdp_url,
                minimum_wait_page_load_time=0.5,
                wait_for_network_idle_page_load_time=1.0,
                wait_between_actions=0.5,
            )

            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=vision_enabled,
            )

            result = await agent.run()
            execution_time = int((time.time() - start_time) * 1000)

            # Parse result
            success = False
            if hasattr(result, "final_result"):
                final_text = (
                    str(result.final_result()).upper()
                    if callable(result.final_result)
                    else str(result.final_result).upper()
                )
                success = "SUCCESS" in final_text

            logger.info(f"[Browser-Use] Resend code result: success={success}")

            return {
                "success": success,
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            logger.error(f"[Browser-Use] Resend code error: {error_str}")

            return {
                "success": False,
                "execution_time_ms": execution_time,
                "error": error_str,
            }
