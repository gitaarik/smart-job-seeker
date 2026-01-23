"""
Execute Task Mixin for Browser Controller.

Provides the execute_task method for running Browser-Use tasks on existing sessions.
"""

import time
import logging
from typing import TYPE_CHECKING

from browser_use import Agent, Browser

from chrome_manager import ChromeManager

if TYPE_CHECKING:
    from ..base import BrowserController

logger = logging.getLogger(__name__)


class ExecuteTaskMixin:
    """Mixin providing execute_task method."""

    async def execute_task(
        self: "BrowserController",
        task: str,
        cdp_port: int = 9222,
        use_vision: bool = True,
    ) -> dict:
        """
        Run a Browser-Use task on the existing browser session.

        The browser must already be running (via /session/start or /login).

        Args:
            task: Natural language task to execute
            cdp_port: CDP port where Chrome is running
            use_vision: Whether to enable visual mode (screenshots) for LLM

        Returns:
            dict with 'success', 'current_url', 'cdp_port', 'execution_time_ms'
        """
        start_time = time.time()

        logger.info(f"[Browser-Use] Executing task on existing session (port {cdp_port})")
        print(f"[Browser-Use] Executing task on existing session (port {cdp_port})", flush=True)

        # Determine vision usage
        vision_enabled = use_vision and self.vision_support
        logger.info(f"[Browser-Use] Vision mode: {vision_enabled}")

        try:
            # Connect to existing Chrome via CDP
            cdp_url = f"http://localhost:{cdp_port}"
            browser = Browser(cdp_url=cdp_url, keep_alive=True)
            self._active_browser = browser

            # Debug: Verify keep_alive is set
            logger.info(f"[Browser-Use] Browser keep_alive: {browser.browser_profile.keep_alive}")
            print(f"[Browser-Use] Browser keep_alive: {browser.browser_profile.keep_alive}", flush=True)

            # Run Browser-Use agent
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=vision_enabled,
            )

            logger.info("[Browser-Use] Starting agent.run()...")
            print("[Browser-Use] Starting agent.run()...", flush=True)
            result = await agent.run()
            logger.info("[Browser-Use] agent.run() completed")
            print("[Browser-Use] agent.run() completed", flush=True)

            # Extract agent's final output for structured responses
            agent_output = ""
            if result and hasattr(result, 'final_result'):
                # final_result is a method in AgentHistoryList, call it
                final = result.final_result()
                if final:
                    agent_output = str(final)
            if not agent_output and result and hasattr(result, 'history') and result.history:
                # Fallback: Get last action's result from history
                last_action = result.history[-1]
                if hasattr(last_action, 'result') and last_action.result:
                    agent_output = str(last_action.result)
            logger.info(f"[Browser-Use] Agent output: {agent_output[:200]}..." if len(agent_output) > 200 else f"[Browser-Use] Agent output: {agent_output}")
            print(f"[Browser-Use] Agent output: {agent_output[:200]}..." if len(agent_output) > 200 else f"[Browser-Use] Agent output: {agent_output}", flush=True)

            # Get the current page URL from the agent's browser context BEFORE disconnecting
            # This is the authoritative source - the page the agent was actually working on
            current_url = ""
            try:
                current_page = await agent.browser_context.get_current_page()
                if current_page:
                    current_url = current_page.url
                    logger.info(f"[Browser-Use] Agent's current page URL: {current_url}")
                    print(f"[Browser-Use] Agent's current page URL: {current_url}", flush=True)
            except Exception as e:
                logger.warning(f"[Browser-Use] Could not get current page from agent: {e}")

            # Close other tabs, keeping only the one the agent was working on
            # This prevents Playwright from connecting to the wrong tab later
            if current_url:
                closed = await ChromeManager.close_tabs_except_url(current_url, cdp_port)
                if closed > 0:
                    logger.info(f"[Browser-Use] Closed {closed} other tab(s)")

            # Disconnect Browser-Use's session
            # This keeps Chrome alive but cleanly disconnects the CDP WebSocket
            # so Playwright can connect without interference
            logger.info("[Browser-Use] Disconnecting Browser-Use session (keep_alive=True)...")
            print("[Browser-Use] Disconnecting Browser-Use session (keep_alive=True)...", flush=True)
            await browser.stop()
            self._active_browser = None

            execution_time = int((time.time() - start_time) * 1000)

            # Verify Chrome is still running with the correct tab
            pages = await ChromeManager.get_pages_info(cdp_port)
            page_tabs = [p for p in pages if p.get("type") == "page"]
            logger.info(f"[Browser-Use] After cleanup, tab count: {len(page_tabs)}")
            print(f"[Browser-Use] After cleanup, tab count: {len(page_tabs)}", flush=True)

            logger.info(f"[Browser-Use] Task completed, current URL: {current_url}")

            return {
                "success": True,
                "current_url": current_url,
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
                "agent_output": agent_output,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)
            logger.error(f"[Browser-Use] Task execution error: {error_str}")

            return {
                "success": False,
                "current_url": "",
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
                "agent_output": "",
                "error": error_str,
            }
