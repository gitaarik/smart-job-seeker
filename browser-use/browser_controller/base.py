"""
Browser Controller for Browser-Use.

Main orchestrator class that coordinates LLM, Chrome, and detection modules
for browser automation tasks.
"""

from browser_use import Browser

from llm_factory import create_llm
from .tasks import (
    ExecuteTaskMixin,
    LoginMixin,
    VerificationMixin,
    SessionMixin,
)


class BrowserController(
    ExecuteTaskMixin,
    LoginMixin,
    VerificationMixin,
    SessionMixin,
):
    """Main controller for browser automation tasks."""

    def __init__(self):
        """Initialize with LLM from factory."""
        self.llm, self.vision_support = create_llm()
        # Keep browser object alive to prevent premature cleanup
        self._active_browser: Browser | None = None
