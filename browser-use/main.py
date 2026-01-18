from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from browser_controller import BrowserController
from typing import Optional, Any
import traceback
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Browser-Use API")


class ExecuteTaskRequest(BaseModel):
    """Generic task execution request"""

    task: str  # Natural language task description
    start_url: str  # URL to start from
    max_time: Optional[int] = 120  # Maximum execution time in seconds
    send_screenshots: Optional[bool] = True  # Whether to send screenshots to LLM


class ExecuteTaskResponse(BaseModel):
    """Generic task execution response"""

    result: Any  # Whatever the agent returns (string, dict, list, etc.)
    execution_time_ms: int


class CdpTaskRequest(BaseModel):
    """Request for executing task via CDP connection to existing browser"""

    task: str  # Natural language task description (login + navigate)
    cdp_url: str  # CDP endpoint URL (e.g., "http://localhost:9222")
    max_time: Optional[int] = 120  # Maximum execution time in seconds
    send_screenshots: Optional[bool] = True  # Whether to send screenshots to LLM


class CdpTaskResponse(BaseModel):
    """Response from CDP task execution"""

    result: Any  # Whatever the agent returns
    execution_time_ms: int
    login_success: bool  # Whether login was successful
    current_url: str  # URL browser ended up on
    ready_for_handoff: bool  # Whether ready for Patchright to take over


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/execute", response_model=ExecuteTaskResponse)
async def execute_task(request: ExecuteTaskRequest):
    """
    Execute an arbitrary browser automation task using natural language.

    Example tasks:
    - "Navigate to example.com and extract all job titles"
    - "Find the pricing page and return the prices as JSON"
    - "Click on the login button and fill in the form"
    """
    try:
        controller = BrowserController()
        result = await controller.execute_task(
            task=request.task,
            start_url=request.start_url,
            max_time=request.max_time,
            send_screenshots=request.send_screenshots,
        )
        return result
    except Exception as e:
        logger.error(f"Error executing task: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/execute-with-cdp", response_model=CdpTaskResponse)
async def execute_task_with_cdp(request: CdpTaskRequest):
    """
    Execute a browser automation task by connecting to an existing Chrome instance via CDP.

    This endpoint is used by the hybrid scraper:
    1. TypeScript launches Chrome with --remote-debugging-port
    2. This endpoint connects Browser-Use to that Chrome instance
    3. Browser-Use performs login and navigates to results page
    4. Returns success status so Patchright can take over for extraction

    The task should be a login-only task that ends on the job search results page.
    """
    try:
        controller = BrowserController()
        result = await controller.execute_task_with_cdp(
            task=request.task,
            cdp_url=request.cdp_url,
            max_time=request.max_time,
            send_screenshots=request.send_screenshots,
        )
        return result
    except Exception as e:
        logger.error(f"Error executing CDP task: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class HybridSessionRequest(BaseModel):
    """Request to start a hybrid session (Browser-Use login, keep browser open for Patchright)"""

    task: str  # Natural language login task
    start_url: str  # URL to start from (login page)
    cdp_port: Optional[int] = 9222  # Port for CDP
    max_time: Optional[int] = 120  # Maximum execution time in seconds
    send_screenshots: Optional[bool] = True  # Whether to send screenshots to LLM


class HybridSessionResponse(BaseModel):
    """Response from hybrid session start"""

    login_success: bool
    current_url: str
    cdp_port: int
    execution_time_ms: int
    error: Optional[str] = None


# Singleton controller for hybrid sessions (keeps browser state)
_hybrid_controller: Optional[BrowserController] = None


def get_hybrid_controller() -> BrowserController:
    global _hybrid_controller
    if _hybrid_controller is None:
        _hybrid_controller = BrowserController()
    return _hybrid_controller


@app.post("/hybrid/start", response_model=HybridSessionResponse)
async def start_hybrid_session(request: HybridSessionRequest):
    """
    Start a hybrid session: Browser-Use launches Chrome with CDP, performs login,
    and keeps the browser open for Patchright to connect and extract jobs.

    Flow:
    1. Browser-Use launches Chrome with CDP enabled on port 9222
    2. Browser-Use performs the login task
    3. Browser stays open (not closed)
    4. Returns success status and CDP port
    5. Patchright connects to localhost:9222 to extract jobs
    6. Call /hybrid/close when done
    """
    try:
        controller = get_hybrid_controller()
        result = await controller.start_hybrid_session(
            task=request.task,
            start_url=request.start_url,
            cdp_port=request.cdp_port,
            max_time=request.max_time,
            send_screenshots=request.send_screenshots,
        )
        return result
    except Exception as e:
        logger.error(f"Error starting hybrid session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/hybrid/close")
async def close_hybrid_session():
    """
    Close the hybrid browser session.
    Call this after Patchright has finished extracting jobs.
    """
    try:
        controller = get_hybrid_controller()
        result = await controller.close_hybrid_session()
        return result
    except Exception as e:
        logger.error(f"Error closing hybrid session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class HybridActionRequest(BaseModel):
    """Request to perform a single action on the existing hybrid browser session"""

    action_type: str  # "click_job" | "close_modal" | "scroll"
    target_description: str  # Natural language description of target
    cdp_port: Optional[int] = 9222
    max_time: Optional[int] = 30  # Shorter timeout for single actions
    send_screenshots: Optional[bool] = True


class HybridActionResponse(BaseModel):
    """Response from hybrid action"""

    success: bool
    action_performed: str  # What the agent actually did
    current_url: str
    execution_time_ms: int
    error: Optional[str] = None


@app.post("/hybrid/action", response_model=HybridActionResponse)
async def perform_hybrid_action(request: HybridActionRequest):
    """
    Perform a single action on the existing hybrid browser session.

    Used by the hybrid scraper to:
    1. Click on a specific job card (visual AI finds it)
    2. Close a modal/dialog after extraction
    3. Scroll to load more content

    The Chrome browser must already be running from /hybrid/start.
    """
    try:
        controller = get_hybrid_controller()
        result = await controller.perform_hybrid_action(
            action_type=request.action_type,
            target_description=request.target_description,
            cdp_port=request.cdp_port,
            max_time=request.max_time,
            send_screenshots=request.send_screenshots,
        )
        return result
    except Exception as e:
        logger.error(f"Error performing hybrid action: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
