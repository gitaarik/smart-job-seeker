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

            # Run Browser-Use agent
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=vision_enabled,
            )

            await agent.run()

            execution_time = int((time.time() - start_time) * 1000)
            current_url = await ChromeManager.get_current_url(cdp_port)

            logger.info(f"[Browser-Use] Task completed, current URL: {current_url}")

            return {
                "success": True,
                "current_url": current_url,
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
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
                "error": error_str,
            }
