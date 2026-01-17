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

    async def execute_task_with_cdp(
        self,
        task: str,
        cdp_url: str,
        max_time: int = 120,
        send_screenshots: bool = True,
    ):
        """
        Execute a browser automation task by connecting to an existing Chrome instance via CDP.
        Used by the hybrid scraper for login-only tasks before handing off to Patchright.

        Args:
            task: Natural language description of what to do (login + navigate to results)
            cdp_url: CDP WebSocket URL (e.g., "http://localhost:9222")
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'result', 'execution_time_ms', 'login_success', 'current_url', 'ready_for_handoff'
        """
        start_time = time.time()

        logger.info(f"[Browser-Use] Connecting to existing browser via CDP: {cdp_url}")
        print(f"[Browser-Use] Connecting to existing browser via CDP: {cdp_url}", flush=True)

        # Determine vision usage
        use_vision_for_task = send_screenshots and self.vision_support
        logger.info(f"[Browser-Use] CDP mode - vision enabled: {use_vision_for_task}")
        print(f"[Browser-Use] CDP mode - vision enabled: {use_vision_for_task}", flush=True)

        try:
            # Connect to existing browser via CDP instead of launching new one
            browser = Browser(
                cdp_url=cdp_url,
                # Don't set headless - browser already running
            )

            # Create the agent (no initial_actions - browser may already be on a page)
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=use_vision_for_task,
            )

            # Run the task
            result = await agent.run()

            execution_time = int((time.time() - start_time) * 1000)

            # Try to get the current URL from the browser context
            current_url = ""
            try:
                # Browser-use provides access to the browser context
                if hasattr(browser, 'context') and browser.context:
                    pages = browser.context.pages
                    if pages:
                        current_url = pages[0].url
                elif hasattr(browser, 'page') and browser.page:
                    current_url = browser.page.url
            except Exception as url_err:
                logger.warning(f"[Browser-Use] Could not get current URL: {url_err}")

            # Determine if login was successful by checking result
            # The agent should report success in its final message
            login_success = False
            ready_for_handoff = False

            if hasattr(result, 'history') and result.history:
                # Check the last history item for success indicators
                for item in reversed(result.history[-5:]):
                    if hasattr(item, 'result') and item.result:
                        for step_result in item.result:
                            if hasattr(step_result, 'extracted_content'):
                                content = str(step_result.extracted_content).lower()
                                if 'success' in content or 'logged in' in content or 'results' in content:
                                    login_success = True
                                    ready_for_handoff = True
                                    break
                    if login_success:
                        break

            # Also check if we're on a search results page (common patterns)
            if current_url:
                url_lower = current_url.lower()
                if any(pattern in url_lower for pattern in ['/jobs', '/search', '/results', 'q=', 'query=']):
                    ready_for_handoff = True
                    if not login_success:
                        login_success = True  # Assume login worked if we reached results

            logger.info(f"[Browser-Use] CDP task complete - URL: {current_url}, login_success: {login_success}")
            print(f"[Browser-Use] CDP task complete - URL: {current_url}, login_success: {login_success}", flush=True)

            return {
                "result": result.model_dump() if hasattr(result, 'model_dump') else result,
                "execution_time_ms": execution_time,
                "login_success": login_success,
                "current_url": current_url,
                "ready_for_handoff": ready_for_handoff,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            # Detect specific error types
            if "rate limit" in error_str.lower() or "429" in error_str:
                error_type = "rate_limit"
                logger.error(f"[Browser-Use] CDP mode - LLM rate limit exceeded: {error_str}")
            elif "context_length" in error_str.lower() or "context length" in error_str.lower():
                error_type = "context_length"
                logger.error(f"[Browser-Use] CDP mode - LLM context length exceeded: {error_str}")
            elif "cdp" in error_str.lower() or "connect" in error_str.lower():
                error_type = "cdp_connection"
                logger.error(f"[Browser-Use] CDP connection failed: {error_str}")
            else:
                error_type = "agent_error"
                logger.error(f"[Browser-Use] CDP mode - Agent error: {error_str}")

            return {
                "result": {
                    "error": error_str,
                    "error_type": error_type,
                },
                "execution_time_ms": execution_time,
                "login_success": False,
                "current_url": "",
                "ready_for_handoff": False,
            }

    # Store browser/process for hybrid mode (keeps browser open between requests)
    _hybrid_browser = None
    _hybrid_chrome_process = None
    _hybrid_socat_process = None

    async def start_hybrid_session(
        self,
        task: str,
        start_url: str,
        cdp_port: int = 9222,
        max_time: int = 120,
        send_screenshots: bool = True,
    ):
        """
        Start a hybrid session: launch Chrome with CDP, perform login, keep browser open.
        The browser stays open so Patchright can connect via CDP for extraction.

        Args:
            task: Natural language login task
            start_url: URL to start from (login page)
            cdp_port: Port for CDP (default 9222)
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'login_success', 'current_url', 'cdp_port', 'execution_time_ms'
        """
        import subprocess
        import asyncio

        start_time = time.time()

        logger.info(f"[Browser-Use] Starting hybrid session with CDP on port {cdp_port}")
        print(f"[Browser-Use] Starting hybrid session with CDP on port {cdp_port}", flush=True)

        # Determine vision usage
        use_vision_for_task = send_screenshots and self.vision_support
        logger.info(f"[Browser-Use] Hybrid mode - vision enabled: {use_vision_for_task}")

        try:
            # Close any existing hybrid session
            await self.close_hybrid_session()

            # Launch Chrome with CDP enabled using subprocess
            # The container has chromium installed via playwright
            import os as os_module
            import glob as glob_module

            chrome_path = None

            # First, try to find Playwright's Chromium (path includes version number)
            playwright_patterns = [
                "/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
                "/home/*/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
            ]
            for pattern in playwright_patterns:
                matches = glob_module.glob(pattern)
                if matches:
                    # Use the most recently modified one (in case multiple versions)
                    chrome_path = max(matches, key=os_module.path.getmtime)
                    break

            # Fallback to system-installed browsers
            if not chrome_path:
                alt_paths = [
                    "/usr/bin/chromium",
                    "/usr/bin/chromium-browser",
                    "/usr/bin/google-chrome",
                ]
                for path in alt_paths:
                    if os_module.path.exists(path):
                        chrome_path = path
                        break

            if not chrome_path:
                raise Exception(
                    "Chrome/Chromium not found. Run 'playwright install chromium' to install."
                )

            headless_mode = os.getenv("SJS_BROWSER_USE_HEADLESS", "true").lower() == "true"

            # Chrome binds to 127.0.0.1 even with --remote-debugging-address=0.0.0.0
            # So we use an internal port and socat to forward from 0.0.0.0:cdp_port
            internal_cdp_port = cdp_port + 1  # e.g., 9223 for internal, 9222 for external

            chrome_args = [
                chrome_path,
                f"--remote-debugging-port={internal_cdp_port}",
                "--remote-debugging-address=0.0.0.0",  # Still try, but likely won't work
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-translate",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                f"--user-data-dir=/tmp/chrome-hybrid-{cdp_port}",
                start_url,  # Open start URL directly
            ]

            if headless_mode:
                chrome_args.insert(1, "--headless=new")

            logger.info(f"[Browser-Use] Launching Chrome: {chrome_path}")
            print(f"[Browser-Use] Launching Chrome on internal port {internal_cdp_port}", flush=True)

            BrowserController._hybrid_chrome_process = subprocess.Popen(
                chrome_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Wait for Chrome CDP to be ready on internal port
            cdp_url = f"http://127.0.0.1:{internal_cdp_port}"
            import aiohttp
            for _ in range(30):  # 15 seconds timeout
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(f"{cdp_url}/json/version", timeout=aiohttp.ClientTimeout(total=1)) as resp:
                            if resp.status == 200:
                                logger.info(f"[Browser-Use] CDP ready at {cdp_url}")
                                print(f"[Browser-Use] CDP ready at {cdp_url}", flush=True)
                                break
                except:
                    pass
                await asyncio.sleep(0.5)
            else:
                raise Exception(f"CDP not ready after 15 seconds at {cdp_url}")

            # Start socat to forward from 0.0.0.0:cdp_port to 127.0.0.1:internal_cdp_port
            # This allows external connections (from host via Docker port mapping)
            logger.info(f"[Browser-Use] Starting socat: 0.0.0.0:{cdp_port} -> 127.0.0.1:{internal_cdp_port}")
            print(f"[Browser-Use] Starting socat: 0.0.0.0:{cdp_port} -> 127.0.0.1:{internal_cdp_port}", flush=True)

            BrowserController._hybrid_socat_process = subprocess.Popen(
                [
                    "socat",
                    f"TCP-LISTEN:{cdp_port},fork,reuseaddr,bind=0.0.0.0",
                    f"TCP:127.0.0.1:{internal_cdp_port}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Give socat a moment to start
            await asyncio.sleep(0.5)

            # Verify socat is running
            if BrowserController._hybrid_socat_process.poll() is not None:
                raise Exception("socat process failed to start")

            logger.info(f"[Browser-Use] socat running, external CDP available at 0.0.0.0:{cdp_port}")
            print(f"[Browser-Use] External CDP available at 0.0.0.0:{cdp_port}", flush=True)

            # Connect browser-use to the Chrome instance via CDP (internal port)
            browser = Browser(cdp_url=cdp_url)
            BrowserController._hybrid_browser = browser

            # Create the agent (no initial_actions since Chrome already opened the URL)
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=use_vision_for_task,
            )

            # Run the login task
            result = await agent.run()

            execution_time = int((time.time() - start_time) * 1000)

            # Note: browser-use resets the session after agent.run() completes,
            # but Chrome should still be running with tabs open.

            # Verify Chrome is still responsive on CDP port
            cdp_responsive = False
            current_url = ""
            for _ in range(5):  # Try a few times
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(f"{cdp_url}/json/list", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                            if resp.status == 200:
                                pages_info = await resp.json()
                                cdp_responsive = True
                                if pages_info:
                                    # Get URL from the first page
                                    current_url = pages_info[0].get('url', '')
                                    logger.info(f"[Browser-Use] CDP still responsive, pages: {len(pages_info)}")
                                    logger.info(f"[Browser-Use] First page URL: {current_url}")
                                break
                except Exception as e:
                    logger.warning(f"[Browser-Use] CDP check failed: {e}")
                    await asyncio.sleep(0.5)

            if not cdp_responsive:
                logger.error("[Browser-Use] Chrome CDP not responsive after agent completed!")
                raise Exception("Chrome CDP became unresponsive after login")

            # Determine success based on multiple indicators
            login_success = False

            # Check URL patterns if URL is available
            if current_url:
                url_lower = current_url.lower()
                if any(pattern in url_lower for pattern in ['/jobs', '/search', '/results', 'q=', 'query=']):
                    login_success = True

            # Check the agent's result for success indicators
            if hasattr(result, 'history') and result.history:
                for item in reversed(result.history[-5:]):
                    # Check for "done" action with success=True
                    if hasattr(item, 'model_output') and item.model_output:
                        output = item.model_output
                        # Check if it's a done action with success flag
                        if hasattr(output, 'action') and output.action:
                            for action in output.action:
                                if hasattr(action, 'done') and action.done:
                                    if getattr(action.done, 'success', False):
                                        login_success = True
                                        # Try to extract URL from the done message
                                        done_text = getattr(action.done, 'text', '')
                                        if done_text:
                                            logger.info(f"[Browser-Use] Done action text: {done_text}")
                                        break

                    # Also check extracted_content for success text
                    if hasattr(item, 'result') and item.result:
                        for step_result in item.result:
                            if hasattr(step_result, 'extracted_content'):
                                content = str(step_result.extracted_content).lower()
                                if 'success' in content or 'logged in' in content or 'job' in content:
                                    login_success = True
                            # Check for done result
                            if hasattr(step_result, 'done') and step_result.done:
                                if getattr(step_result, 'success', False):
                                    login_success = True

                    if login_success:
                        break

            logger.info(f"[Browser-Use] Hybrid login complete - URL: {current_url}, success: {login_success}")
            print(f"[Browser-Use] Hybrid login complete - URL: {current_url}, success: {login_success}", flush=True)
            print(f"[Browser-Use] Browser kept open on CDP port {cdp_port}", flush=True)

            return {
                "login_success": login_success,
                "current_url": current_url,
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            logger.error(f"[Browser-Use] Hybrid session error: {error_str}")

            # Clean up on error
            await self.close_hybrid_session()

            return {
                "login_success": False,
                "current_url": "",
                "cdp_port": cdp_port,
                "execution_time_ms": execution_time,
                "error": error_str,
            }

    async def close_hybrid_session(self):
        """Close the hybrid browser session and Chrome process."""
        # Clear the browser-use reference (it doesn't have a close method)
        if BrowserController._hybrid_browser:
            BrowserController._hybrid_browser = None
            logger.info("[Browser-Use] Hybrid browser reference cleared")

        # Kill socat process first (it forwards to Chrome)
        if BrowserController._hybrid_socat_process:
            try:
                BrowserController._hybrid_socat_process.terminate()
                BrowserController._hybrid_socat_process.wait(timeout=2)
                logger.info("[Browser-Use] socat process terminated")
            except Exception as e:
                logger.warning(f"[Browser-Use] Error terminating socat: {e}")
                try:
                    BrowserController._hybrid_socat_process.kill()
                except:
                    pass
            finally:
                BrowserController._hybrid_socat_process = None

        # Kill Chrome process
        if BrowserController._hybrid_chrome_process:
            try:
                BrowserController._hybrid_chrome_process.terminate()
                BrowserController._hybrid_chrome_process.wait(timeout=5)
                logger.info("[Browser-Use] Chrome process terminated")
                print("[Browser-Use] Chrome process terminated", flush=True)
            except Exception as e:
                logger.warning(f"[Browser-Use] Error terminating Chrome: {e}")
                try:
                    BrowserController._hybrid_chrome_process.kill()
                except:
                    pass
            finally:
                BrowserController._hybrid_chrome_process = None

        return {"closed": True}
