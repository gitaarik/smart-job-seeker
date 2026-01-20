import os
import time
import json
import logging
import asyncio
import subprocess
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
        solve_captcha: bool = False,
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
            solve_captcha: If True, Browser-Use will attempt to solve CAPTCHAs automatically.
                          If False (default), returns captcha_needed=True for manual solving.

        Returns:
            dict with 'login_success', 'current_url', 'cdp_port', 'execution_time_ms', 'captcha_needed'
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

            # Kill any orphaned Chrome processes and remove lock files
            session_dir = "/app/data/sessions/chrome-user-data"
            try:
                subprocess.run(["pkill", "-9", "chrome"], capture_output=True, timeout=5)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"[Browser-Use] pkill warning: {e}")

            # Remove all Singleton* lock files
            try:
                lock_files = glob_module.glob(os.path.join(session_dir, "Singleton*"))
                for lock_file in lock_files:
                    try:
                        os.remove(lock_file)
                        logger.info(f"[Browser-Use] Removed lock file: {lock_file}")
                    except Exception as e:
                        logger.warning(f"[Browser-Use] Could not remove {lock_file}: {e}")
            except Exception as e:
                logger.warning(f"[Browser-Use] Lock cleanup warning: {e}")

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

            # Use persistent session storage (cookies persist across runs)
            session_dir = "/app/data/sessions/chrome-user-data"
            os.makedirs(session_dir, exist_ok=True)

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
                f"--user-data-dir={session_dir}",
                start_url,  # Open start URL directly
            ]

            if headless_mode:
                chrome_args.insert(1, "--headless=new")

            logger.info(f"[Browser-Use] Launching Chrome: {chrome_path}")
            print(f"[Browser-Use] Launching Chrome on internal port {internal_cdp_port}", flush=True)

            # Set up environment with DISPLAY for GUI mode
            chrome_env = os.environ.copy()
            chrome_env["DISPLAY"] = os.environ.get("DISPLAY", ":99")

            BrowserController._hybrid_chrome_process = subprocess.Popen(
                chrome_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=chrome_env,
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
                # Check if Chrome process died
                if BrowserController._hybrid_chrome_process.poll() is not None:
                    stderr = BrowserController._hybrid_chrome_process.stderr.read().decode() if BrowserController._hybrid_chrome_process.stderr else ""
                    logger.error(f"[Browser-Use] Chrome process died. stderr: {stderr[:500]}")
                    raise Exception(f"Chrome process died. stderr: {stderr[:500]}")
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

            # Check for verification/2FA requirement first
            verification_needed = False
            verification_type = None
            verification_prompt = None
            page_text = ""

            # First check: URL-based detection (if still on auth/login/verify page after login attempt)
            if current_url:
                url_lower = current_url.lower()
                auth_url_patterns = ['/auth', '/login', '/signin', '/verify', '/challenge', '/2fa', '/mfa', '/otp']
                if any(pattern in url_lower for pattern in auth_url_patterns):
                    logger.info(f"[Browser-Use] Still on auth page after login: {current_url}")
                    print(f"[Browser-Use] Still on auth page after login: {current_url}", flush=True)
                    # Likely need verification - will confirm with page content check

            # Get page content to check for verification indicators
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{cdp_url}/json/list", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                        if resp.status == 200:
                            pages_info = await resp.json()
                            if pages_info:
                                # Use CDP to get page content
                                page_ws_url = pages_info[0].get('webSocketDebuggerUrl', '')
                                if page_ws_url:
                                    import websockets
                                    try:
                                        async with websockets.connect(page_ws_url, close_timeout=5) as ws:
                                            # Get page HTML to check for verification patterns
                                            await ws.send(json.dumps({
                                                "id": 1,
                                                "method": "Runtime.evaluate",
                                                "params": {"expression": "document.body.innerText"}
                                            }))
                                            ws_response = await asyncio.wait_for(ws.recv(), timeout=5)
                                            page_text = json.loads(ws_response).get('result', {}).get('result', {}).get('value', '').lower()
                                            logger.info(f"[Browser-Use] Got page text ({len(page_text)} chars)")
                                    except Exception as ws_err:
                                        logger.warning(f"[Browser-Use] WebSocket error getting page content: {ws_err}")
                                        print(f"[Browser-Use] WebSocket error: {ws_err}", flush=True)
            except Exception as e:
                logger.warning(f"[Browser-Use] Error getting page info: {e}")
                print(f"[Browser-Use] Error getting page info: {e}", flush=True)

            # Check page content for verification patterns
            # IMPORTANT: We need to distinguish between:
            # - CAPTCHA/human verification (agent should solve these, NOT flag as verification_needed)
            # - Actual verification CODES (email, SMS, 2FA - user needs to provide these)
            if page_text:
                import re

                # First, check if this is a CAPTCHA page (should NOT trigger verification_needed)
                captcha_patterns = [
                    'verify you are human',
                    'verify you.re human',
                    'i.m not a robot',
                    'not a robot',
                    'security check',
                    'cloudflare',
                    'turnstile',
                    'recaptcha',
                    'hcaptcha',
                    'prove you.re human',
                    'confirm you.re human',
                    'human verification',
                    'bot detection',
                ]
                is_captcha_page = any(re.search(pattern, page_text) for pattern in captcha_patterns)

                if is_captcha_page:
                    if solve_captcha:
                        logger.info(f"[Browser-Use] Detected CAPTCHA page - agent will attempt to solve")
                        print(f"[Browser-Use] Detected CAPTCHA page - agent will attempt to solve", flush=True)
                        # Continue - let agent handle it (or it already did)
                    else:
                        logger.info(f"[Browser-Use] Detected CAPTCHA page - manual intervention required")
                        print(f"[Browser-Use] Detected CAPTCHA page - manual intervention required", flush=True)
                        # Return early - user needs to solve CAPTCHA manually
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
                    # Check for actual verification CODE patterns (sent to email/phone/authenticator)
                    verification_patterns = [
                        ('email', ['check your email', 'sent.*code.*email', 'sent to your email', 'email.*code', 'we sent you', 'we.ve sent']),
                        ('sms', ['check your phone', 'sent.*code.*phone', 'sent to your phone', 'sms.*code', 'text message']),
                        ('2fa', ['two-factor', '2fa', 'authenticator app', 'authentication app', 'google authenticator', 'authy']),
                        ('code', ['enter the code we sent', 'enter your code', 'verification code sent', 'one-time password', 'otp']),
                    ]

                    for vtype, patterns in verification_patterns:
                        for pattern in patterns:
                            if re.search(pattern, page_text):
                                verification_needed = True
                                verification_type = vtype
                                logger.info(f"[Browser-Use] Found verification CODE pattern: {pattern}")
                                print(f"[Browser-Use] Found verification CODE pattern: {pattern}", flush=True)
                                break
                        if verification_needed:
                            break

            # Check if agent explicitly reported CAPTCHA_NEEDED or VERIFICATION_NEEDED
            agent_reported_captcha = False
            if hasattr(result, 'final_result'):
                final_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()
                if 'CAPTCHA_NEEDED' in final_text:
                    agent_reported_captcha = True
                    logger.info(f"[Browser-Use] Agent reported CAPTCHA_NEEDED during login")
                    print(f"[Browser-Use] Agent reported CAPTCHA_NEEDED during login", flush=True)

            if agent_reported_captcha:
                return {
                    "success": False,
                    "login_success": False,
                    "captcha_needed": True,
                    "verification_needed": False,
                    "current_url": current_url,
                    "cdp_port": cdp_port,
                    "execution_time_ms": execution_time,
                }

            if not verification_needed and hasattr(result, 'history') and result.history:
                for item in reversed(result.history[-5:]):
                    if hasattr(item, 'model_output') and item.model_output:
                        output = item.model_output
                        if hasattr(output, 'action') and output.action:
                            for action in output.action:
                                if hasattr(action, 'done') and action.done:
                                    done_text = getattr(action.done, 'text', '').upper()
                                    # Only flag if agent explicitly said VERIFICATION_NEEDED
                                    if 'VERIFICATION_NEEDED' in done_text:
                                        verification_needed = True
                                        verification_type = 'code'
                                        logger.info(f"[Browser-Use] Agent reported VERIFICATION_NEEDED: {done_text[:100]}")
                                        print(f"[Browser-Use] Agent reported VERIFICATION_NEEDED", flush=True)
                                        break
                            if verification_needed:
                                break
                    if verification_needed:
                        break

            # Generate user-friendly prompt
            if verification_needed:
                if verification_type == 'email':
                    verification_prompt = "Please check your email for a verification code"
                elif verification_type == 'sms':
                    verification_prompt = "Please check your phone for an SMS verification code"
                elif verification_type == '2fa':
                    verification_prompt = "Please enter your 2FA/authenticator code"
                else:
                    verification_prompt = "Please enter the verification code"

                logger.info(f"[Browser-Use] Verification needed: {verification_type}")
                print(f"[Browser-Use] Verification needed: {verification_type}", flush=True)

            # If verification is needed, return early (don't close browser)
            if verification_needed:
                return {
                    "login_success": False,
                    "captcha_needed": False,
                    "verification_needed": True,
                    "verification_type": verification_type,
                    "verification_prompt": verification_prompt,
                    "current_url": current_url,
                    "cdp_port": cdp_port,
                    "execution_time_ms": execution_time,
                }

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

            # Clean up on error
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
        Connects to the existing browser via CDP and enters the code.

        Args:
            task: Task prompt from database (with {{code}} already interpolated)
            code: The verification code to enter
            cdp_port: CDP port (default 9222)
            max_time: Maximum execution time in seconds
            send_screenshots: Whether to send screenshots to LLM

        Returns:
            dict with 'success', 'login_complete', 'needs_new_code', 'current_url', 'error'
        """
        import asyncio
        import aiohttp
        import json

        start_time = time.time()

        # Build the internal CDP URL (internal port is cdp_port + 1)
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info(f"[Browser-Use] Submitting verification code")
        print(f"[Browser-Use] Submitting verification code", flush=True)

        # Determine vision usage
        use_vision_for_task = send_screenshots and self.vision_support

        try:
            # Verify Chrome is still running on CDP port
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(
                        f"{cdp_url}/json/version",
                        timeout=aiohttp.ClientTimeout(total=2)
                    ) as resp:
                        if resp.status != 200:
                            raise Exception("CDP not responding")
                except Exception as e:
                    return {
                        "success": False,
                        "login_complete": False,
                        "needs_new_code": False,
                        "current_url": "",
                        "execution_time_ms": int((time.time() - start_time) * 1000),
                        "error": f"Chrome not running on CDP port {cdp_port}: {e}",
                    }

            # Connect Browser-Use to existing Chrome via CDP
            browser = Browser(
                cdp_url=cdp_url,
                minimum_wait_page_load_time=1.0,
                wait_for_network_idle_page_load_time=2.0,
                wait_between_actions=1.0,
            )

            # Create agent for verification code entry
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=use_vision_for_task,
            )

            # Run the verification task
            result = await agent.run()

            execution_time = int((time.time() - start_time) * 1000)

            # Get current URL
            current_url = ""
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{cdp_url}/json/list",
                        timeout=aiohttp.ClientTimeout(total=2)
                    ) as resp:
                        if resp.status == 200:
                            pages_info = await resp.json()
                            if pages_info:
                                current_url = pages_info[0].get('url', '')
            except Exception as url_err:
                logger.warning(f"[Browser-Use] Could not get current URL: {url_err}")

            # Parse result to determine outcome
            success = False
            login_complete = False
            needs_new_code = False
            captcha_needed = False  # CAPTCHA appeared, needs manual solving

            # Get final result text
            final_result_text = ""
            if hasattr(result, 'final_result'):
                final_result_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()

            # Debug: log the final result text
            logger.info(f"[Browser-Use] final_result_text: {final_result_text[:200] if final_result_text else 'EMPTY'}")
            print(f"[Browser-Use] final_result_text: {final_result_text[:200] if final_result_text else 'EMPTY'}", flush=True)

            # Parse outcomes
            if final_result_text:
                if 'SUCCESS' in final_result_text:
                    success = True
                    login_complete = True
                elif 'INVALID_CODE' in final_result_text:
                    success = False
                    login_complete = False
                elif 'NEEDS_NEW_CODE' in final_result_text or 'EXPIRED' in final_result_text:
                    success = False
                    login_complete = False
                    needs_new_code = True
                elif 'CAPTCHA_NEEDED' in final_result_text or 'CAPTCHA' in final_result_text or 'VERIFY' in final_result_text:
                    # CAPTCHA appeared - user needs to solve it manually
                    success = False
                    login_complete = False
                    captcha_needed = True

            # Fallback: check history
            if not success and hasattr(result, 'history') and result.history:
                for item in reversed(result.history[-5:]):
                    if hasattr(item, 'model_output') and item.model_output:
                        output = item.model_output
                        if hasattr(output, 'action') and output.action:
                            for action in output.action:
                                if hasattr(action, 'done') and action.done:
                                    done_text = getattr(action.done, 'text', '').upper()
                                    if 'SUCCESS' in done_text:
                                        success = True
                                        login_complete = True
                                    elif 'INVALID' in done_text:
                                        success = False
                                    elif 'EXPIRED' in done_text or 'NEW_CODE' in done_text:
                                        needs_new_code = True
                                    break

            # Also check if URL indicates successful login
            if current_url:
                url_lower = current_url.lower()
                # If we're now on a jobs/dashboard page, login succeeded
                if any(pattern in url_lower for pattern in ['/jobs', '/search', '/results', '/dashboard', '/feed', '/home']):
                    success = True
                    login_complete = True
                # If still on login/verify page, not complete
                elif any(pattern in url_lower for pattern in ['/login', '/verify', '/code', '/2fa', '/challenge']):
                    login_complete = False

            logger.info(f"[Browser-Use] Verification result: success={success}, login_complete={login_complete}, needs_new_code={needs_new_code}, captcha_needed={captcha_needed}")
            print(f"[Browser-Use] Verification result: success={success}, login_complete={login_complete}, needs_new_code={needs_new_code}, captcha_needed={captcha_needed}", flush=True)

            return {
                "success": success,
                "login_complete": login_complete,
                "needs_new_code": needs_new_code,
                "captcha_needed": captcha_needed,  # CAPTCHA appeared, user must solve manually
                "current_url": current_url,
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_str = str(e)

            logger.error(f"[Browser-Use] Verification code submission error: {error_str}")
            print(f"[Browser-Use] Verification code submission error: {error_str}", flush=True)

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
        import asyncio
        import aiohttp

        start_time = time.time()

        # Build the internal CDP URL
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        logger.info(f"[Browser-Use] Requesting new verification code")
        print(f"[Browser-Use] Requesting new verification code", flush=True)

        # Determine vision usage
        use_vision_for_task = send_screenshots and self.vision_support

        try:
            # Verify Chrome is still running
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(
                        f"{cdp_url}/json/version",
                        timeout=aiohttp.ClientTimeout(total=2)
                    ) as resp:
                        if resp.status != 200:
                            raise Exception("CDP not responding")
                except Exception as e:
                    return {
                        "success": False,
                        "execution_time_ms": int((time.time() - start_time) * 1000),
                        "error": f"Chrome not running on CDP port {cdp_port}: {e}",
                    }

            # Connect to Chrome via CDP
            browser = Browser(
                cdp_url=cdp_url,
                minimum_wait_page_load_time=0.5,
                wait_for_network_idle_page_load_time=1.0,
                wait_between_actions=0.5,
            )

            # Create agent
            agent = Agent(
                task=task,
                llm=self.llm,
                browser=browser,
                use_vision=use_vision_for_task,
            )

            # Run the resend task
            result = await agent.run()

            execution_time = int((time.time() - start_time) * 1000)

            # Parse result
            success = False
            final_result_text = ""
            if hasattr(result, 'final_result'):
                final_result_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()

            if 'SUCCESS' in final_result_text:
                success = True

            logger.info(f"[Browser-Use] Resend code result: success={success}")
            print(f"[Browser-Use] Resend code result: success={success}", flush=True)

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
    # Session Management Methods
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
        import shutil
        session_dir = "/app/data/sessions/chrome-user-data"
        session_exists = os.path.exists(session_dir) and os.path.isdir(session_dir)

        if not session_exists:
            return {
                "session_exists": False,
                "is_logged_in": False,
                "current_url": "",
                "cdp_port": cdp_port,
            }

        # Launch browser with existing session
        await self._launch_chrome_with_session(check_url, cdp_port)

        # Wait for page to load and check URL
        await asyncio.sleep(3)  # Give page time to load/redirect

        # Get current URL via CDP
        current_url = await self._get_current_url_via_cdp(cdp_port)

        # Check if we're on login page (not logged in)
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
        await self._launch_chrome_with_session(start_url, cdp_port)

        # Get current URL
        current_url = await self._get_current_url_via_cdp(cdp_port)

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
            current_url = await self._get_current_url_via_cdp(cdp_port)

            # Check if URL matches target pattern (login successful)
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

    async def _launch_chrome_with_session(
        self,
        start_url: str,
        cdp_port: int = 9222,
    ):
        """
        Helper to launch Chrome with persistent session directory.
        Reuses existing launch logic from start_hybrid_session.
        """
        # Close any existing session first
        try:
            await self.close_hybrid_session()
        except Exception:
            pass

        # Kill any orphaned Chrome processes and remove lock files
        session_dir = "/app/data/sessions/chrome-user-data"
        try:
            # Kill all Chrome processes (aggressive cleanup)
            subprocess.run(["pkill", "-9", "chrome"], capture_output=True, timeout=5)
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.warning(f"[Session] pkill warning: {e}")

        # Remove all Singleton* lock files
        try:
            import glob as glob_module
            lock_files = glob_module.glob(os.path.join(session_dir, "Singleton*"))
            for lock_file in lock_files:
                try:
                    os.remove(lock_file)
                    logger.info(f"[Session] Removed lock file: {lock_file}")
                except Exception as e:
                    logger.warning(f"[Session] Could not remove {lock_file}: {e}")
        except Exception as e:
            logger.warning(f"[Session] Lock cleanup warning: {e}")

        # Use the same Chrome launch logic as start_hybrid_session
        chrome_path = None
        for pattern in [
            "/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
            "/usr/bin/chromium",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
        ]:
            import glob as glob_module
            matches = glob_module.glob(pattern)
            if matches:
                chrome_path = matches[0]
                break

        if not chrome_path:
            raise Exception("Chrome/Chromium not found")

        headless_mode = os.getenv("SJS_BROWSER_USE_HEADLESS", "true").lower() == "true"
        internal_cdp_port = cdp_port + 1

        # Use persistent session storage
        session_dir = "/app/data/sessions/chrome-user-data"
        os.makedirs(session_dir, exist_ok=True)

        chrome_args = [
            chrome_path,
            f"--remote-debugging-port={internal_cdp_port}",
            "--remote-debugging-address=0.0.0.0",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--user-data-dir={session_dir}",
            start_url,
        ]

        if headless_mode:
            chrome_args.insert(1, "--headless=new")

        logger.info(f"[Session] Launching Chrome: {chrome_path}")
        print(f"[Session] Launching Chrome on internal port {internal_cdp_port}", flush=True)

        # Set up environment with DISPLAY for GUI mode
        chrome_env = os.environ.copy()
        chrome_env["DISPLAY"] = os.environ.get("DISPLAY", ":99")

        BrowserController._hybrid_chrome_process = subprocess.Popen(
            chrome_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=chrome_env,
        )

        # Wait for Chrome CDP to be ready
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"
        import aiohttp
        for _ in range(30):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{cdp_url}/json/version", timeout=aiohttp.ClientTimeout(total=1)) as resp:
                        if resp.status == 200:
                            logger.info(f"[Session] CDP ready at {cdp_url}")
                            break
            except Exception:
                pass
            # Check if Chrome process died
            if BrowserController._hybrid_chrome_process.poll() is not None:
                stderr = BrowserController._hybrid_chrome_process.stderr.read().decode() if BrowserController._hybrid_chrome_process.stderr else ""
                logger.error(f"[Session] Chrome process died. stderr: {stderr[:500]}")
                raise Exception(f"Chrome process died. stderr: {stderr[:500]}")
            await asyncio.sleep(0.5)
        else:
            # Check for Chrome stderr on timeout
            stderr = ""
            if BrowserController._hybrid_chrome_process.poll() is not None:
                stderr = BrowserController._hybrid_chrome_process.stderr.read().decode() if BrowserController._hybrid_chrome_process.stderr else ""
            raise Exception(f"CDP not ready after 15 seconds at {cdp_url}. Chrome stderr: {stderr[:500]}")

        # Start socat for port forwarding
        BrowserController._hybrid_socat_process = subprocess.Popen(
            [
                "socat",
                f"TCP-LISTEN:{cdp_port},fork,reuseaddr,bind=0.0.0.0",
                f"TCP:127.0.0.1:{internal_cdp_port}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        await asyncio.sleep(0.5)
        if BrowserController._hybrid_socat_process.poll() is not None:
            raise Exception("socat process failed to start")

        logger.info(f"[Session] External CDP available at 0.0.0.0:{cdp_port}")

    async def _get_current_url_via_cdp(self, cdp_port: int = 9222) -> str:
        """
        Get current page URL via CDP.
        """
        import aiohttp
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{cdp_url}/json", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        pages = await resp.json()
                        if pages:
                            return pages[0].get("url", "")
        except Exception as e:
            logger.error(f"[Session] Error getting URL via CDP: {e}")

        return ""
