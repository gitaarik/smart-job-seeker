from browser_use import Agent, Browser
from browser_use.browser.browser import BrowserConfig
from langchain_groq import ChatGroq
import os
import time


class BrowserController:
    def __init__(self):
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.3,
        )

    async def execute_task(self, task: str, start_url: str, max_time: int = 120):
        """
        Execute an arbitrary browser automation task using natural language.

        Args:
            task: Natural language description of what to do
            start_url: URL to start from
            max_time: Maximum execution time in seconds

        Returns:
            dict with 'result' and 'execution_time_ms'
        """
        start_time = time.time()

        # Create the agent
        # Note: use_vision=False because Groq doesn't support multimodal/vision content
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=Browser(
                config=BrowserConfig(
                    headless=os.getenv("BROWSER_HEADLESS", "true") == "true"
                )
            ),
            use_vision=False,
        )

        # Run the task
        result = await agent.run()

        execution_time = int((time.time() - start_time) * 1000)

        return {
            "result": result,
            "execution_time_ms": execution_time,
        }
