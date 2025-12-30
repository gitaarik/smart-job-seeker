from browser_use import Agent, Browser
from browser_use.browser.browser import BrowserConfig
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
import os
import time


class BrowserController:
    def __init__(self):
        provider = os.getenv("SJS_LLM_PROVIDER", "groq").lower()

        if provider == "gemini":
            # Use Google Gemini
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                api_key=os.getenv("SJS_GEMINI_API_KEY"),
                temperature=0.3,
            )
            # Gemini supports vision
            self.use_vision = True
        else:
            # Default to Groq
            self.llm = ChatGroq(
                model="llama-3.3-70b-versatile",
                api_key=os.getenv("SJS_GROQ_API_KEY"),
                temperature=0.3,
            )
            # Groq doesn't support vision
            self.use_vision = False

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
        # Note: use_vision depends on LLM provider (Gemini supports it, Groq doesn't)
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=Browser(
                config=BrowserConfig(
                    headless=os.getenv("SJS_BROWSER_USE_HEADLESS") == "true"
                )
            ),
            use_vision=self.use_vision,
        )

        # Run the task
        result = await agent.run()

        execution_time = int((time.time() - start_time) * 1000)

        return {
            "result": result,
            "execution_time_ms": execution_time,
        }
