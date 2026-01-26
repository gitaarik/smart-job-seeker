"""
Chrome Manager module for Browser-Use.

Handles Chrome process lifecycle and CDP (Chrome DevTools Protocol) connections.
"""

import os
import glob
import json
import asyncio
import logging
import subprocess
from typing import Optional

import aiohttp
import websockets

logger = logging.getLogger(__name__)

# Session directory for persistent Chrome data
SESSION_DIR = "/app/data/sessions/chrome-user-data"


class ChromeManager:
    """Manages Chrome process lifecycle and CDP connections."""

    _chrome_process: Optional[subprocess.Popen] = None
    _socat_process: Optional[subprocess.Popen] = None

    @classmethod
    def _find_chrome_path(cls) -> str:
        """Find Chrome/Chromium executable path."""
        # First, try Playwright's Chromium (path includes version number)
        playwright_patterns = [
            "/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
            "/home/*/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
        ]

        for pattern in playwright_patterns:
            matches = glob.glob(pattern)
            if matches:
                # Use the most recently modified one
                return max(matches, key=os.path.getmtime)

        # Fallback to system-installed browsers
        alt_paths = [
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
        ]

        for path in alt_paths:
            if os.path.exists(path):
                return path

        raise FileNotFoundError(
            "Chrome/Chromium not found. Run 'playwright install chromium' to install."
        )

    @classmethod
    def _setup_preferences(cls) -> None:
        """Set up Chrome preferences to disable unwanted prompts."""
        default_dir = os.path.join(SESSION_DIR, "Default")
        os.makedirs(default_dir, exist_ok=True)
        prefs_path = os.path.join(default_dir, "Preferences")

        # Load existing preferences or start fresh
        prefs = {}
        if os.path.exists(prefs_path):
            try:
                with open(prefs_path, "r") as f:
                    prefs = json.load(f)
            except (json.JSONDecodeError, IOError):
                prefs = {}

        # Disable password manager prompts
        if "credentials_enable_service" not in prefs:
            prefs["credentials_enable_service"] = False
        if "profile" not in prefs:
            prefs["profile"] = {}
        prefs["profile"]["password_manager_enabled"] = False

        # Disable session restore prompt
        if "session" not in prefs:
            prefs["session"] = {}
        prefs["session"]["restore_on_startup"] = 1  # 1 = open new tab page
        if "browser" not in prefs:
            prefs["browser"] = {}
        prefs["browser"]["show_home_button"] = False

        # Disable "Chrome didn't shut down correctly" bubble
        if "profile" not in prefs:
            prefs["profile"] = {}
        prefs["profile"]["exit_type"] = "Normal"
        prefs["profile"]["exited_cleanly"] = True

        try:
            with open(prefs_path, "w") as f:
                json.dump(prefs, f, indent=2)
            logger.info("[Chrome] Preferences configured")
        except IOError as e:
            logger.warning(f"[Chrome] Could not write preferences: {e}")

    @classmethod
    def _cleanup_lock_files(cls) -> None:
        """Remove Chrome singleton lock files."""
        try:
            lock_files = glob.glob(os.path.join(SESSION_DIR, "Singleton*"))
            for lock_file in lock_files:
                try:
                    os.remove(lock_file)
                    logger.info(f"[Chrome] Removed lock file: {lock_file}")
                except Exception as e:
                    logger.warning(f"[Chrome] Could not remove {lock_file}: {e}")
        except Exception as e:
            logger.warning(f"[Chrome] Lock cleanup warning: {e}")

    @classmethod
    async def launch(
        cls,
        start_url: str,
        cdp_port: int = 9222,
    ) -> str:
        """
        Launch Chrome with CDP enabled.

        Args:
            start_url: URL to open on launch
            cdp_port: External CDP port (internal will be cdp_port + 1)

        Returns:
            Internal CDP URL (http://127.0.0.1:{internal_port})
        """
        # Clean up any existing Chrome and socat processes first
        await cls.close()
        cls._cleanup_lock_files()
        cls._setup_preferences()

        chrome_path = cls._find_chrome_path()

        # Chrome binds to 127.0.0.1 even with --remote-debugging-address=0.0.0.0
        # So we use internal port and socat to forward from external port
        internal_cdp_port = cdp_port + 1

        # Ensure session directory exists
        os.makedirs(SESSION_DIR, exist_ok=True)

        chrome_args = [
            chrome_path,
            f"--remote-debugging-port={internal_cdp_port}",
            "--remote-debugging-address=0.0.0.0",
            "--no-sandbox",  # Required when running as root in container
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--disable-dev-shm-usage",
            # Window size - larger for better Browser-Use screenshot analysis
            "--window-size=1920,1080",
            "--window-position=0,0",
            # Disable session restore popup and tab restoration after crash
            "--disable-session-crashed-bubble",
            "--hide-crash-restore-bubble",
            "--no-restore-state",  # Don't restore previous tabs/windows
            # Disable password manager prompts
            "--password-store=basic",
            "--disable-save-password-bubble",
            # Anti-bot stealth flags
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            f"--user-data-dir={SESSION_DIR}",
            start_url,
        ]

        logger.info(f"[Chrome] Launching: {chrome_path}")
        print(f"[Chrome] Launching on internal port {internal_cdp_port}", flush=True)

        # Set up environment with DISPLAY for GUI mode
        chrome_env = os.environ.copy()
        chrome_env["DISPLAY"] = os.environ.get("DISPLAY", ":99")

        cls._chrome_process = subprocess.Popen(
            chrome_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=chrome_env,
        )

        # Wait for CDP to be ready
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"
        await cls._wait_for_cdp_ready(cdp_url)

        # Start socat for port forwarding
        await cls._start_socat(cdp_port, internal_cdp_port)

        logger.info(f"[Chrome] External CDP available at 0.0.0.0:{cdp_port}")
        print(f"[Chrome] External CDP available at 0.0.0.0:{cdp_port}", flush=True)

        return cdp_url

    @classmethod
    async def _wait_for_cdp_ready(cls, cdp_url: str, timeout: int = 15) -> None:
        """Wait for CDP endpoint to become ready."""
        for _ in range(timeout * 2):  # Check every 0.5s
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{cdp_url}/json/version",
                        timeout=aiohttp.ClientTimeout(total=1)
                    ) as resp:
                        if resp.status == 200:
                            logger.info(f"[Chrome] CDP ready at {cdp_url}")
                            print(f"[Chrome] CDP ready at {cdp_url}", flush=True)
                            return
            except Exception:
                pass

            # Check if Chrome process died
            if cls._chrome_process and cls._chrome_process.poll() is not None:
                stderr = ""
                if cls._chrome_process.stderr:
                    stderr = cls._chrome_process.stderr.read().decode()
                logger.error(f"[Chrome] Process died. stderr: {stderr[:500]}")
                raise RuntimeError(f"Chrome process died. stderr: {stderr[:500]}")

            await asyncio.sleep(0.5)

        raise TimeoutError(f"CDP not ready after {timeout} seconds at {cdp_url}")

    @classmethod
    async def _start_socat(cls, external_port: int, internal_port: int) -> None:
        """Start socat for port forwarding."""
        logger.info(f"[Chrome] Starting socat: 0.0.0.0:{external_port} -> 127.0.0.1:{internal_port}")
        print(f"[Chrome] Starting socat: 0.0.0.0:{external_port} -> 127.0.0.1:{internal_port}", flush=True)

        cls._socat_process = subprocess.Popen(
            [
                "socat",
                f"TCP-LISTEN:{external_port},fork,reuseaddr,bind=0.0.0.0",
                f"TCP:127.0.0.1:{internal_port}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        await asyncio.sleep(0.5)

        if cls._socat_process.poll() is not None:
            stderr = ""
            if cls._socat_process.stderr:
                stderr = cls._socat_process.stderr.read().decode()
            logger.error(f"[Chrome] socat failed with stderr: {stderr}")
            raise RuntimeError(f"socat process failed to start: {stderr}")

    @classmethod
    async def close(cls) -> None:
        """Close Chrome and socat processes."""
        # Kill tracked socat process
        if cls._socat_process:
            try:
                cls._socat_process.terminate()
                cls._socat_process.wait(timeout=2)
                logger.info("[Chrome] socat process terminated")
            except Exception as e:
                logger.warning(f"[Chrome] Error terminating socat: {e}")
                try:
                    cls._socat_process.kill()
                except Exception:
                    pass
            finally:
                cls._socat_process = None

        # Kill tracked Chrome process
        if cls._chrome_process:
            try:
                cls._chrome_process.terminate()
                cls._chrome_process.wait(timeout=5)
                logger.info("[Chrome] Process terminated")
                print("[Chrome] Process terminated", flush=True)
            except Exception as e:
                logger.warning(f"[Chrome] Error terminating: {e}")
                try:
                    cls._chrome_process.kill()
                except Exception:
                    pass
            finally:
                cls._chrome_process = None

        # Also kill any orphaned processes (in case references were lost)
        try:
            subprocess.run(["pkill", "-9", "socat"], capture_output=True, timeout=5)
            subprocess.run(["pkill", "-9", "chrome"], capture_output=True, timeout=5)
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"[Chrome] pkill cleanup warning: {e}")

    @classmethod
    async def is_cdp_ready(cls, cdp_url: str) -> bool:
        """Check if CDP endpoint is responding."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{cdp_url}/json/version",
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    return resp.status == 200
        except Exception:
            return False

    @classmethod
    async def get_current_url(cls, cdp_port: int = 9222) -> str:
        """Get current page URL via CDP."""
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{cdp_url}/json/list",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        all_pages = await resp.json()
                        # Filter to actual page tabs (not service workers, iframes, etc.)
                        pages = [p for p in all_pages if p.get("type") == "page"]
                        if pages:
                            return pages[0].get("url", "")
        except Exception as e:
            logger.error(f"[Chrome] Error getting URL via CDP: {e}")

        return ""

    @classmethod
    async def get_pages_info(cls, cdp_port: int = 9222) -> list:
        """Get list of pages via CDP."""
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{cdp_url}/json/list",
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception as e:
            logger.warning(f"[Chrome] Error getting pages info: {e}")

        return []

    @classmethod
    async def get_page_text(cls, cdp_port: int = 9222) -> str:
        """Get page body text via CDP WebSocket."""
        pages_info = await cls.get_pages_info(cdp_port)

        # Filter to actual page tabs (not service workers, iframes, etc.)
        pages = [p for p in pages_info if p.get("type") == "page"]
        if not pages:
            return ""

        page_ws_url = pages[0].get("webSocketDebuggerUrl", "")
        if not page_ws_url:
            return ""

        try:
            async with websockets.connect(page_ws_url, close_timeout=5) as ws:
                await ws.send(json.dumps({
                    "id": 1,
                    "method": "Runtime.evaluate",
                    "params": {"expression": "document.body.innerText"}
                }))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                result = json.loads(response)
                return result.get("result", {}).get("result", {}).get("value", "").lower()
        except Exception as e:
            logger.warning(f"[Chrome] WebSocket error getting page text: {e}")
            return ""

    @classmethod
    async def close_extra_tabs(cls, cdp_port: int = 9222) -> int:
        """
        Close all tabs except one.

        Args:
            cdp_port: External CDP port

        Returns:
            Number of tabs closed
        """
        pages_info = await cls.get_pages_info(cdp_port)

        # Filter to actual page tabs (not service workers, iframes, etc.)
        pages = [p for p in pages_info if p.get("type") == "page"]

        if len(pages) <= 1:
            return 0

        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"
        closed_count = 0

        # Close all tabs except the first one
        for page in pages[1:]:
            target_id = page.get("id")
            if not target_id:
                continue

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{cdp_url}/json/close/{target_id}",
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status == 200:
                            closed_count += 1
                            logger.info(f"[Chrome] Closed tab: {page.get('url', 'unknown')[:50]}")
            except Exception as e:
                logger.warning(f"[Chrome] Error closing tab {target_id}: {e}")

        if closed_count > 0:
            print(f"[Chrome] Closed {closed_count} extra tab(s)", flush=True)

        return closed_count

    @classmethod
    async def close_tabs_except_url(cls, keep_url: str, cdp_port: int = 9222) -> int:
        """
        Close all tabs except the one matching the given URL.

        Args:
            keep_url: URL of the tab to keep (others will be closed)
            cdp_port: External CDP port

        Returns:
            Number of tabs closed
        """
        pages_info = await cls.get_pages_info(cdp_port)

        # Filter to actual pages (not iframes, workers, service workers)
        pages = [p for p in pages_info if p.get("type") == "page"]

        if len(pages) <= 1:
            return 0

        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"
        closed_count = 0

        # Find the tab to keep by matching URL
        keep_tab_id = None
        for page in pages:
            page_url = page.get("url", "")
            if page_url == keep_url or page_url.rstrip("/") == keep_url.rstrip("/"):
                keep_tab_id = page.get("id")
                logger.info(f"[Chrome] Keeping tab: {page_url[:60]}")
                break

        if not keep_tab_id:
            logger.warning(f"[Chrome] No tab found matching URL: {keep_url[:60]}")
            # Fall back to keeping the first page tab
            keep_tab_id = pages[0].get("id") if pages else None

        # Close all tabs except the one we want to keep
        for page in pages:
            target_id = page.get("id")
            if not target_id or target_id == keep_tab_id:
                continue

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{cdp_url}/json/close/{target_id}",
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status == 200:
                            closed_count += 1
                            logger.info(f"[Chrome] Closed tab: {page.get('url', 'unknown')[:50]}")
            except Exception as e:
                logger.warning(f"[Chrome] Error closing tab {target_id}: {e}")

        if closed_count > 0:
            print(f"[Chrome] Closed {closed_count} other tab(s), kept: {keep_url[:60]}", flush=True)

        return closed_count

    @classmethod
    async def navigate_tab_to_blank(cls, cdp_port: int = 9222) -> bool:
        """
        Navigate the first tab to about:blank.

        Args:
            cdp_port: External CDP port

        Returns:
            True if successful
        """
        pages_info = await cls.get_pages_info(cdp_port)
        if not pages_info:
            return False

        page_ws_url = pages_info[0].get("webSocketDebuggerUrl", "")
        if not page_ws_url:
            return False

        try:
            async with websockets.connect(page_ws_url, close_timeout=10) as ws:
                await ws.send(json.dumps({
                    "id": 1,
                    "method": "Page.navigate",
                    "params": {"url": "about:blank"}
                }))
                await asyncio.wait_for(ws.recv(), timeout=5)
                return True
        except Exception as e:
            logger.warning(f"[Chrome] Error navigating to blank: {e}")
            return False

    @classmethod
    async def ensure_single_blank_tab(cls, cdp_port: int = 9222) -> str:
        """
        Ensure Chrome is running with exactly one blank tab.

        This is the recommended way to prepare Chrome before browser-use connects.
        Browser-use will handle all navigation via its task prompt.

        Args:
            cdp_port: External CDP port

        Returns:
            Internal CDP URL
        """
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        # Check if Chrome is already running
        if cls.is_running() and await cls.is_cdp_ready(cdp_url):
            logger.info("[Chrome] Already running, cleaning up tabs...")
            print("[Chrome] Already running, cleaning up tabs...", flush=True)

            # Close extra tabs
            await cls.close_extra_tabs(cdp_port)

            # Navigate remaining tab to blank
            await cls.navigate_tab_to_blank(cdp_port)

            return cdp_url

        # Chrome not running - launch with blank page
        logger.info("[Chrome] Launching with blank page...")
        print("[Chrome] Launching with blank page...", flush=True)
        return await cls.launch("about:blank", cdp_port)

    @classmethod
    def session_exists(cls) -> bool:
        """Check if session directory exists."""
        return os.path.exists(SESSION_DIR) and os.path.isdir(SESSION_DIR)

    @classmethod
    def is_running(cls) -> bool:
        """Check if Chrome process is running."""
        return cls._chrome_process is not None and cls._chrome_process.poll() is None

    @classmethod
    async def navigate(cls, url: str, cdp_port: int = 9222) -> str:
        """
        Navigate to URL, launching Chrome if needed.

        This is the main entry point for browser navigation. It:
        - Launches Chrome if not running
        - Navigates to the URL in the existing tab if already running

        Args:
            url: URL to navigate to
            cdp_port: External CDP port

        Returns:
            Internal CDP URL
        """
        internal_cdp_port = cdp_port + 1
        cdp_url = f"http://127.0.0.1:{internal_cdp_port}"

        # Check if Chrome is already running and CDP is ready
        if cls.is_running() and await cls.is_cdp_ready(cdp_url):
            # Chrome is running - navigate via CDP
            logger.info(f"[Chrome] Already running, navigating to: {url}")
            print(f"[Chrome] Navigating to: {url}", flush=True)

            pages_info = await cls.get_pages_info(cdp_port)
            # Filter to actual page tabs (not service workers, iframes, etc.)
            pages = [p for p in pages_info if p.get("type") == "page"]
            if not pages:
                logger.warning("[Chrome] No page tabs found, will relaunch")
            else:
                page_ws_url = pages[0].get("webSocketDebuggerUrl", "")
                if not page_ws_url:
                    logger.warning("[Chrome] No WebSocket URL found, will relaunch")
                else:
                    try:
                        async with websockets.connect(page_ws_url, close_timeout=10) as ws:
                            await ws.send(json.dumps({
                                "id": 1,
                                "method": "Page.navigate",
                                "params": {"url": url}
                            }))
                            response = await asyncio.wait_for(ws.recv(), timeout=10)
                            result = json.loads(response)

                            # Check for navigation errors
                            if "error" in result:
                                logger.warning(f"[Chrome] CDP navigate error: {result['error']}")
                            else:
                                # Wait for page to load
                                await asyncio.sleep(2)
                                logger.info(f"[Chrome] Navigation complete")
                                print(f"[Chrome] Navigation complete", flush=True)
                                return cdp_url
                    except Exception as e:
                        logger.warning(f"[Chrome] CDP navigate failed: {e}, will relaunch")

            # CDP navigation failed - close and relaunch
            logger.info("[Chrome] Closing existing instance before relaunch")
            print("[Chrome] Closing existing instance before relaunch", flush=True)

        # Chrome not running or CDP failed - launch fresh
        return await cls.launch(url, cdp_port)
