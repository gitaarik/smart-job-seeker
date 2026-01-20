"""
Browser Controller for Browser-Use.

Main orchestrator class that coordinates LLM, Chrome, and detection modules
for browser automation tasks.
"""

import os
import time
import logging
import asyncio

from browser_use import Agent, Browser

from llm_factory import create_llm
from chrome_manager import ChromeManager
from detection import (
    is_captcha_page,
    detect_verification_required,
    is_on_success_page,
    check_agent_result_for_captcha,
    check_agent_result_for_verification,
    check_agent_result_for_success,
    parse_verification_result,
)

logger = logging.getLogger(__name__)


class BrowserController:
    """Main controller for browser automation tasks."""

    def __init__(self):
        """Initialize with LLM from factory."""
        self.llm, self.vision_support = create_llm()
        # Keep browser object alive to prevent premature cleanup
        self._active_browser: Browser | None = None

    async def execute_task(
        self,
        task: str,
        start_url: str,
        max_time: int = 120,
        send_screenshots: bool = True,
    ):
        """
        Execute an arbitrary browser automation task using natural language.

        Args:
            task: Natural language description of what to do
            start_url: URL to start from
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'result' and 'execution_time_ms'
        """
        start_time = time.time()

        headless_mode = os.getenv("SJS_BROWSER_USE_HEADLESS", "true").lower() == "true"

        logger.info(f"[Browser-Use] Running in {'headless' if headless_mode else 'headed'} mode")
        print(f"[Browser-Use] Running in {'headless' if headless_mode else 'headed'} mode", flush=True)

        # Determine vision usage
        use_vision = send_screenshots and self.vision_support
        logger.info(f"[Browser-Use] Vision mode: {use_vision}")
        print(f"[Browser-Use] Vision mode: {use_vision}", flush=True)

        # Navigate to start_url before executing task
        initial_actions = [{"navigate": {"url": start_url}}]
        logger.info(f"[Browser-Use] Will navigate to: {start_url}")
        print(f"[Browser-Use] Will navigate to: {start_url}", flush=True)

        browser = Browser(
            headless=headless_mode,
            minimum_wait_page_load_time=1.0,
            wait_for_network_idle_page_load_time=2.0,
            wait_between_actions=2.0,
        )

        agent = Agent(
            task=task,
            llm=self.llm,
            browser=browser,
            use_vision=use_vision,
            initial_actions=initial_actions,
        )

        try:
            result = await agent.run()
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            # Detect specific error types
            if "rate limit" in error_str.lower() or "429" in error_str:
                error_type = "rate_limit"
                logger.error(f"[Browser-Use] LLM rate limit exceeded: {error_str}")
            elif "context_length" in error_str.lower() or "context length" in error_str.lower():
                error_type = "context_length"
                logger.error(f"[Browser-Use] LLM context length exceeded: {error_str}")
            else:
                error_type = "agent_error"
                logger.error(f"[Browser-Use] Agent error: {error_str}")

            return {
                "result": {"error": error_str, "error_type": error_type},
                "execution_time_ms": execution_time,
            }

        execution_time = int((time.time() - start_time) * 1000)

        # Check for rate limit errors in history
        if hasattr(result, 'history') and result.history:
            for item in result.history[-3:]:
                if hasattr(item, 'result') and item.result:
                    for step_result in item.result:
                        if hasattr(step_result, 'error') and step_result.error:
                            error_str = step_result.error
                            if "rate limit" in error_str.lower() or "429" in error_str:
                                logger.error(f"[Browser-Use] LLM rate limit in history: {error_str}")
                                return {
                                    "result": {
                                        "error": error_str,
                                        "error_type": "rate_limit",
                                        "history": result.model_dump() if hasattr(result, 'model_dump') else str(result),
                                    },
                                    "execution_time_ms": execution_time,
                                }

        return {
            "result": result.model_dump() if hasattr(result, 'model_dump') else result,
            "execution_time_ms": execution_time,
        }

    async def start_hybrid_session(
        self,
        task: str,
        start_url: str,
        cdp_port: int = 9222,
        max_time: int = 120,
        send_screenshots: bool = True,
        solve_captcha: bool = False,
    ):
        """
        Start a hybrid session: launch Chrome with CDP, perform login, keep browser open.

        Args:
            task: Natural language login task
            start_url: URL to start from (login page)
            cdp_port: Port for CDP (default 9222)
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM
            solve_captcha: If True, Browser-Use attempts to solve CAPTCHAs

        Returns:
            dict with 'login_success', 'current_url', 'cdp_port', etc.
        """
        start_time = time.time()

        logger.info(f"[Browser-Use] Starting hybrid session with CDP on port {cdp_port}")
        print(f"[Browser-Use] Starting hybrid session with CDP on port {cdp_port}", flush=True)

        use_vision = send_screenshots and self.vision_support

        try:
            # Close any existing session
            await self.close_hybrid_session()

            # Launch Chrome with CDP
            cdp_url = await ChromeManager.launch(start_url, cdp_port)

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
                use_vision=use_vision,
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
                        logger.info("[Browser-Use] Detected CAPTCHA - agent will attempt to solve")
                    else:
                        logger.info("[Browser-Use] Detected CAPTCHA - manual intervention required")
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
                    verification_needed, vtype, prompt = detect_verification_required(page_text)

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
            login_success = is_on_success_page(current_url) or check_agent_result_for_success(result)

            logger.info(f"[Browser-Use] Hybrid login complete - success: {login_success}")
            print(f"[Browser-Use] Browser kept open on CDP port {cdp_port}", flush=True)

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

            logger.error(f"[Browser-Use] Hybrid session error: {error_str}")
            await self.close_hybrid_session()

            return {
                "login_success": False,
                "captcha_needed": False,
                "verification_needed": False,
                "current_url": "",
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
                "error": error_str,
            }

    async def close_hybrid_session(self):
        """Close the hybrid browser session."""
        # Clear browser reference to allow cleanup
        self._active_browser = None
        await ChromeManager.close()
        return {"closed": True}

    async def submit_verification_code(
        self,
        task: str,
        code: str,
        cdp_port: int = 9222,
        max_time: int = 60,
        send_screenshots: bool = True,
    ):
        """
        Submit a verification code and continue the login process.

        Args:
            task: Task prompt (with {{code}} already interpolated)
            code: The verification code to enter
            cdp_port: CDP port (default 9222)
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'success', 'login_complete', 'needs_new_code', etc.
        """
        start_time = time.time()
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info("[Browser-Use] Submitting verification code")
        print("[Browser-Use] Submitting verification code", flush=True)

        use_vision = send_screenshots and self.vision_support

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
                use_vision=use_vision,
            )

            result = await agent.run()
            execution_time = int((time.time() - start_time) * 1000)

            current_url = await ChromeManager.get_current_url(cdp_port)

            # Parse result
            success, login_complete, needs_new_code, captcha_needed = parse_verification_result(result)

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
        self,
        task: str,
        cdp_port: int = 9222,
        max_time: int = 30,
        send_screenshots: bool = True,
    ):
        """
        Click the 'resend code' button on the verification page.

        Args:
            task: Task prompt from database
            cdp_port: CDP port (default 9222)
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'success', 'error'
        """
        start_time = time.time()
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info("[Browser-Use] Requesting new verification code")
        print("[Browser-Use] Requesting new verification code", flush=True)

        use_vision = send_screenshots and self.vision_support

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
                use_vision=use_vision,
            )

            result = await agent.run()
            execution_time = int((time.time() - start_time) * 1000)

            # Parse result
            success = False
            if hasattr(result, 'final_result'):
                final_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()
                success = 'SUCCESS' in final_text

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

    # =====================
    # Session Management
    # =====================

    async def check_session(
        self,
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

        # Launch browser with existing session
        await ChromeManager.launch(check_url, cdp_port)

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
        self,
        start_url: str,
        cdp_port: int = 9222,
    ) -> dict:
        """
        Start browser with existing persistent session (no login attempt).
        """
        await ChromeManager.launch(start_url, cdp_port)
        current_url = await ChromeManager.get_current_url(cdp_port)

        return {
            "success": True,
            "current_url": current_url,
            "cdp_port": cdp_port,
            "vnc_url": "localhost:5900",
        }

    async def wait_for_login(
        self,
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
