"""
Execute Task Mixin for Browser Controller.

Provides the execute_task method for arbitrary browser automation tasks.
"""

import time
import logging
from typing import TYPE_CHECKING

from browser_use import Agent, Browser

if TYPE_CHECKING:
    from ..base import BrowserController

logger = logging.getLogger(__name__)


class ExecuteTaskMixin:
    """Mixin providing execute_task method."""

    async def execute_task(
        self: "BrowserController",
        task: str,
        start_url: str,
        max_time: int = 120,
        use_vision: bool = True,
    ):
        """
        Execute an arbitrary browser automation task using natural language.

        Args:
            task: Natural language description of what to do
            start_url: URL to start from
            max_time: Maximum execution time in seconds
            use_vision: Whether to enable visual mode (screenshots) for LLM

        Returns:
            dict with 'result' and 'execution_time_ms'
        """
        start_time = time.time()

        # Determine vision usage
        vision_enabled = use_vision and self.vision_support
        logger.info(f"[Browser-Use] Vision mode: {vision_enabled}")
        print(f"[Browser-Use] Vision mode: {vision_enabled}", flush=True)

        # Navigate to start_url before executing task
        initial_actions = [{"navigate": {"url": start_url}}]
        logger.info(f"[Browser-Use] Will navigate to: {start_url}")
        print(f"[Browser-Use] Will navigate to: {start_url}", flush=True)

        # Always run headed for better anti-detection (requires DISPLAY)
        browser = Browser(
            headless=False,
            minimum_wait_page_load_time=1.0,
            wait_for_network_idle_page_load_time=2.0,
            wait_between_actions=2.0,
        )

        agent = Agent(
            task=task,
            llm=self.llm,
            browser=browser,
            use_vision=vision_enabled,
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
            elif (
                "context_length" in error_str.lower()
                or "context length" in error_str.lower()
            ):
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
        if hasattr(result, "history") and result.history:
            for item in result.history[-3:]:
                if hasattr(item, "result") and item.result:
                    for step_result in item.result:
                        if hasattr(step_result, "error") and step_result.error:
                            error_str = step_result.error
                            if "rate limit" in error_str.lower() or "429" in error_str:
                                logger.error(
                                    f"[Browser-Use] LLM rate limit in history: {error_str}"
                                )
                                return {
                                    "result": {
                                        "error": error_str,
                                        "error_type": "rate_limit",
                                        "history": result.model_dump()
                                        if hasattr(result, "model_dump")
                                        else str(result),
                                    },
                                    "execution_time_ms": execution_time,
                                }

        return {
            "result": result.model_dump() if hasattr(result, "model_dump") else result,
            "execution_time_ms": execution_time,
        }
