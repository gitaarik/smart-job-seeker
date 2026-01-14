import os
import time
import logging
from browser_use import Agent, Browser, ChatBrowserUse
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_aws import ChatBedrock
from browser_use.browser.browser import BrowserConfig

logger = logging.getLogger(__name__)


class BrowserController:
    def __init__(self):
        # Browser-use specific settings with fallback to main LLM settings
        provider = os.getenv(
            "SJS_LLM_PROVIDER_BROWSER_USE", os.getenv("SJS_LLM_PROVIDER", "groq")
        ).lower()

        logger.info(f"[Browser-Use] Initializing with provider: {provider}")
        print(f"[Browser-Use] Initializing with provider: {provider}", flush=True)

        # Default models per provider (hardcoded fallbacks)
        default_models = {
            "browser_use": None,
            "groq": "llama-3.3-70b-versatile",
            "gemini": "gemini-2.0-flash-exp",
            "openai": "gpt-4o",
            "openrouter": "anthropic/claude-3.5-sonnet",
            "deepseek": "deepseek-chat",
            "bedrock": "amazon.nova-micro-v1:0",
        }

        # Provider-specific env var names
        provider_env_vars = {
            "browser_use": "SJS_LLM_MODEL_BROWSER_USE",
            "groq": "SJS_LLM_MODEL_GROQ",
            "gemini": "SJS_LLM_MODEL_GEMINI",
            "openai": "SJS_LLM_MODEL_OPENAI",
            "openrouter": "SJS_LLM_MODEL_OPENROUTER",
            "deepseek": "SJS_LLM_MODEL_DEEPSEEK",
            "bedrock": "SJS_LLM_MODEL_BEDROCK",
        }

        # Get model with priority:
        # 1. Provider-specific env var (e.g., SJS_LLM_MODEL_GROQ if provider is groq)
        # 2. Hardcoded default
        hardcoded_default = default_models.get(provider, default_models["groq"])
        provider_env_var = provider_env_vars.get(provider)
        model = (
            os.getenv(provider_env_var, hardcoded_default)
            if provider_env_var
            else hardcoded_default
        )
        # Handle empty string from environment variables
        if not model:
            model = hardcoded_default

        logger.info(f"[Browser-Use] Using model: {model}")
        print(f"[Browser-Use] Using model: {model}", flush=True)

        if provider == "browser_use":
            self.llm = ChatBrowserUse()
            # API key is taken from `BROWSER_USE_API_KEY` env var
            # Browser-Use supports vision
            self.vision_support = True
        elif provider == "gemini":
            # Use Google Gemini
            self.llm = ChatGoogleGenerativeAI(
                model=model,
                api_key=os.getenv("SJS_LLM_API_KEY_GEMINI"),
                temperature=0.3,
            )
            # Gemini supports vision
            self.vision_support = True
        elif provider == "openai":
            # Use OpenAI
            self.llm = ChatOpenAI(
                model=model,
                api_key=os.getenv("SJS_LLM_API_KEY_OPENAI"),
                temperature=0.3,
            )
            # GPT-4o supports vision
            self.vision_support = True
        elif provider == "openrouter":
            # Use OpenRouter
            self.llm = ChatOpenAI(
                model=model,
                base_url="https://openrouter.ai/api/v1",
                api_key=os.getenv("SJS_LLM_API_KEY_OPENROUTER"),
                temperature=0.3,
            )
            # OpenRouter vision support depends on model
            # Claude 3.5 Sonnet and other vision models support it
            self.vision_support = (
                "claude" in model
                or "gpt-4" in model
                or "gemini" in model
                or "qvq" in model
            )
        elif provider == "deepseek":
            # Use DeepSeek
            self.llm = ChatOpenAI(
                model=model,
                base_url="https://api.deepseek.com",
                api_key=os.getenv("SJS_LLM_API_KEY_DEEPSEEK"),
                temperature=0.3,
            )
            # DeepSeek v3 supports vision
            self.vision_support = "v3" in model
        elif provider == "bedrock":
            # Use AWS Bedrock
            # Handle empty strings from Docker (treat "" as None)
            aws_region = os.getenv("SJS_AWS_REGION") or "us-east-1"
            aws_profile = os.getenv("SJS_AWS_PROFILE")

            bedrock_config = {
                "model_id": model,
                "region_name": aws_region,
                "model_kwargs": {"temperature": 0.3},
            }
            # Only use profile if explicitly set, otherwise use environment variables
            if aws_profile:
                bedrock_config["credentials_profile_name"] = aws_profile

            self.llm = ChatBedrock(**bedrock_config)
            # Claude and Nova models on Bedrock support vision
            self.vision_support = "anthropic.claude" in model or "amazon.nova" in model
        else:
            # Default to Groq
            self.llm = ChatGroq(
                model=model,
                api_key=os.getenv("SJS_LLM_API_KEY_GROQ"),
                temperature=0.3,
            )
            # Groq doesn't support vision
            self.vision_support = False

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

        # Always use headless mode - browser is visible via VNC regardless
        headless_mode = os.getenv("SJS_BROWSER_USE_HEADLESS", "true").lower() == "true"

        logger.info(
            f"[Browser-Use] Running in {'headless' if headless_mode else 'headed'} mode (visible via VNC)"
        )
        print(
            f"[Browser-Use] Running in {'headless' if headless_mode else 'headed'} mode (visible via VNC)",
            flush=True,
        )

        # Determine vision usage: send_screenshots AND LLM supports vision
        use_vision_for_task = send_screenshots and self.vision_support
        logger.info(f"[Browser-Use] send_screenshots parameter: {send_screenshots}")
        logger.info(f"[Browser-Use] LLM supports vision: {self.vision_support}")
        logger.info(f"[Browser-Use] Final vision mode: {use_vision_for_task}")
        print(
            f"[Browser-Use] send_screenshots parameter: {send_screenshots}", flush=True
        )
        print(f"[Browser-Use] LLM supports vision: {self.vision_support}", flush=True)
        print(f"[Browser-Use] Final vision mode: {use_vision_for_task}", flush=True)

        # Navigate to start_url before executing task
        initial_actions = [
            {"go_to_url": {"url": start_url}},
        ]
        logger.info(f"[Browser-Use] Will navigate to: {start_url}")
        print(f"[Browser-Use] Will navigate to: {start_url}", flush=True)

        # Create the agent with token optimization
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=Browser(config=BrowserConfig(headless=headless_mode)),
            use_vision=use_vision_for_task,
            initial_actions=initial_actions,
            # Token optimization settings
            # max_input_tokens=64000,  # Limit DOM size sent to LLM
            # max_actions_per_step=5,  # Reduce actions considered per step
        )

        # Run the task
        result = await agent.run()

        execution_time = int((time.time() - start_time) * 1000)

        return {
            "result": result,
            "execution_time_ms": execution_time,
        }
