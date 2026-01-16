import os
import time
import logging
from browser_use import Agent, Browser, ChatBrowserUse
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_aws import ChatBedrock

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
        # Note: browser_use uses their own optimized model, no model selection needed
        default_models = {
            "groq": "llama-3.3-70b-versatile",
            "gemini": "gemini-2.0-flash-exp",
            "openai": "gpt-4o",
            "openrouter": "anthropic/claude-3.5-sonnet",
            "deepseek": "deepseek-chat",
            "bedrock": "amazon.nova-micro-v1:0",
            "browser_use": None,  # Uses their optimized model automatically
        }

        # Provider-specific env var names
        provider_env_vars = {
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

        if provider == "gemini":
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
        elif provider == "browser_use":
            # Use Browser-Use's optimized cloud LLM
            # API key from BROWSER_USE_API_KEY env var (their default) or our naming convention
            api_key = os.getenv("SJS_LLM_API_KEY_BROWSER_USE") or os.getenv("BROWSER_USE_API_KEY")
            if not api_key:
                raise ValueError(
                    "Browser-Use API key not found. Set SJS_LLM_API_KEY_BROWSER_USE or BROWSER_USE_API_KEY. "
                    "Get a key at: https://cloud.browser-use.com/new-api-key"
                )
            # Use the Browser-Use optimized model
            bu_model = os.getenv("SJS_LLM_MODEL_BROWSER_USE") or "browser-use/bu-30b-a3b-preview"
            self.llm = ChatBrowserUse(model=bu_model, api_key=api_key)
            # Browser-Use cloud supports vision
            self.vision_support = True
            logger.info(f"[Browser-Use] Using Browser-Use cloud LLM: {bu_model}")
            print(f"[Browser-Use] Using Browser-Use cloud LLM: {bu_model}", flush=True)
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
            {"navigate": {"url": start_url}},
        ]
        logger.info(f"[Browser-Use] Will navigate to: {start_url}")
        print(f"[Browser-Use] Will navigate to: {start_url}", flush=True)

        # Create browser with increased wait times for reliable navigation
        # This helps with login flows that involve multiple redirects
        browser = Browser(
            headless=headless_mode,
            minimum_wait_page_load_time=1.0,       # Wait at least 1s before getting page state
            wait_for_network_idle_page_load_time=2.0,  # Wait 2s for network idle
            wait_between_actions=2.0,              # Wait 2s between actions
        )

        # Create the agent with token optimization
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=browser,
            use_vision=use_vision_for_task,
            initial_actions=initial_actions,
        )

        # Run the task
        try:
            result = await agent.run()
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            # Detect specific error types for clearer messaging
            if "rate limit" in error_str.lower() or "429" in error_str:
                error_type = "rate_limit"
                logger.error(f"[Browser-Use] LLM rate limit exceeded: {error_str}")
            elif "context_length" in error_str.lower() or "context length" in error_str.lower():
                error_type = "context_length"
                logger.error(f"[Browser-Use] LLM context length exceeded: {error_str}")
            else:
                error_type = "agent_error"
                logger.error(f"[Browser-Use] Agent error: {error_str}")

            # Return structured error instead of raising
            return {
                "result": {
                    "error": error_str,
                    "error_type": error_type,
                },
                "execution_time_ms": execution_time,
            }

        execution_time = int((time.time() - start_time) * 1000)

        # Check if result contains errors (browser-use returns errors in history)
        if hasattr(result, 'history') and result.history:
            # Check for errors in the last few history items
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
