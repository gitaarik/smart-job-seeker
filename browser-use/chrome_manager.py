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
    async def _kill_orphaned_chrome(cls) -> None:
        """Kill any orphaned Chrome processes."""
        try:
            subprocess.run(["pkill", "-9", "chrome"], capture_output=True, timeout=5)
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.warning(f"[Chrome] pkill warning: {e}")

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
        # Clean up first
        await cls._kill_orphaned_chrome()
        cls._cleanup_lock_files()

        chrome_path = cls._find_chrome_path()
        headless_mode = os.getenv("SJS_BROWSER_USE_HEADLESS", "true").lower() == "true"

        # Chrome binds to 127.0.0.1 even with --remote-debugging-address=0.0.0.0
        # So we use internal port and socat to forward from external port
        internal_cdp_port = cdp_port + 1

        # Ensure session directory exists
        os.makedirs(SESSION_DIR, exist_ok=True)

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
            f"--user-data-dir={SESSION_DIR}",
            start_url,
        ]

        if headless_mode:
            chrome_args.insert(1, "--headless=new")

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
            raise RuntimeError("socat process failed to start")

    @classmethod
    async def close(cls) -> None:
        """Close Chrome and socat processes."""
        # Kill socat first
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

        # Kill Chrome
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
                        pages = await resp.json()
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

        if not pages_info:
            return ""

        page_ws_url = pages_info[0].get("webSocketDebuggerUrl", "")
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
    def session_exists(cls) -> bool:
        """Check if session directory exists."""
        return os.path.exists(SESSION_DIR) and os.path.isdir(SESSION_DIR)
