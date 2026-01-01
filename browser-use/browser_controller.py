from browser_use import Agent, Browser
from browser_use.browser.browser import BrowserConfig
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
import os
import time
import logging

logger = logging.getLogger(__name__)


class BrowserController:
    def __init__(self):
        # Browser-use specific settings with fallback to main LLM settings
        provider = os.getenv(
            "SJS_LLM_PROVIDER_BROWSER_USE",
            os.getenv("SJS_LLM_PROVIDER", "groq")
        ).lower()

        logger.info(f"[Browser-Use] Initializing with provider: {provider}")
        print(f"[Browser-Use] Initializing with provider: {provider}", flush=True)

        # Default models per provider (hardcoded fallbacks)
        default_models = {
            "groq": "llama-3.3-70b-versatile",
            "gemini": "gemini-2.0-flash-exp",
            "openai": "gpt-4o",
            "openrouter": "anthropic/claude-3.5-sonnet",
            "deepseek": "deepseek-chat",
            "browseruse": "gpt-4o",
        }

        # Provider-specific env var names (for main providers, not browser-use override)
        provider_env_vars = {
            "groq": "SJS_LLM_MODEL_GROQ",
            "gemini": "SJS_LLM_MODEL_GEMINI",
            "openai": "SJS_LLM_MODEL_OPENAI",
            "openrouter": "SJS_LLM_MODEL_OPENROUTER",
            "deepseek": "SJS_LLM_MODEL_DEEPSEEK",
            "browseruse": "SJS_LLM_MODEL_BROWSER_USE",
        }

        # Get model with priority:
        # 1. SJS_LLM_MODEL_BROWSER_USE (Browser-Use specific override)
        # 2. Provider-specific env var (e.g., SJS_LLM_MODEL_GROQ if provider is groq)
        # 3. Hardcoded default
        hardcoded_default = default_models.get(provider, default_models["groq"])
        provider_env_var = provider_env_vars.get(provider)
        provider_specific_model = os.getenv(provider_env_var, hardcoded_default) if provider_env_var else hardcoded_default
        model = os.getenv("SJS_LLM_MODEL_BROWSER_USE", provider_specific_model)

        logger.info(f"[Browser-Use] Using model: {model}")
        print(f"[Browser-Use] Using model: {model}", flush=True)

        if provider == "gemini":
            # Use Google Gemini
            self.llm = ChatGoogleGenerativeAI(
                model=model,
                api_key=os.getenv("SJS_GEMINI_API_KEY"),
                temperature=0.3,
            )
            # Gemini supports vision
            self.use_vision = True
        elif provider == "openai":
            # Use OpenAI
            self.llm = ChatOpenAI(
                model=model,
                api_key=os.getenv("SJS_OPENAI_API_KEY"),
                temperature=0.3,
            )
            # GPT-4o supports vision
            self.use_vision = True
        elif provider == "openrouter":
            # Use OpenRouter
            self.llm = ChatOpenAI(
                model=model,
                base_url="https://openrouter.ai/api/v1",
                api_key=os.getenv("SJS_OPENROUTER_API_KEY"),
                temperature=0.3,
            )
            # OpenRouter vision support depends on model
            # Claude 3.5 Sonnet and other vision models support it
            self.use_vision = "claude" in model or "gpt-4" in model or "gemini" in model or "qvq" in model
        elif provider == "deepseek":
            # Use DeepSeek
            self.llm = ChatOpenAI(
                model=model,
                base_url="https://api.deepseek.com",
                api_key=os.getenv("SJS_DEEPSEEK_API_KEY"),
                temperature=0.3,
            )
            # DeepSeek v3 supports vision
            self.use_vision = "v3" in model
        elif provider == "browseruse":
            # Use Browser Use Cloud via OpenAI-compatible API
            self.llm = ChatOpenAI(
                model="gpt-4o",  # Browser Use Cloud's optimized model
                base_url="https://cloud.browser-use.com/v1",
                api_key=os.getenv("SJS_BROWSERUSE_API_KEY"),
                temperature=0.3,
            )
            # Browser Use Cloud supports vision
            self.use_vision = True
        else:
            # Default to Groq
            self.llm = ChatGroq(
                model=model,
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
