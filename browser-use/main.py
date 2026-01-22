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
    use_vision: Optional[bool] = True  # Whether to enable visual mode (screenshots) for LLM


class ExecuteTaskResponse(BaseModel):
    """Generic task execution response"""

    result: Any  # Whatever the agent returns (string, dict, list, etc.)
    execution_time_ms: int


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
            use_vision=request.use_vision,
        )
        return result
    except Exception as e:
        logger.error(f"Error executing task: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class LoginRequest(BaseModel):
    """Request to start an AI-powered login session"""

    task: str  # Natural language login task
    start_url: str  # URL to start from (login page)
    cdp_port: Optional[int] = 9222  # Port for CDP
    max_time: Optional[int] = 120  # Maximum execution time in seconds
    use_vision: Optional[bool] = True  # Whether to enable visual mode (screenshots) for LLM
    solve_captcha: Optional[bool] = False  # If True, Browser-Use attempts to solve CAPTCHAs


class LoginResponse(BaseModel):
    """Response from login session"""

    login_success: bool
    captcha_needed: Optional[bool] = False  # True if CAPTCHA needs manual solving
    verification_needed: Optional[bool] = False  # True if 2FA/verification required
    verification_type: Optional[str] = None  # "email", "sms", "2fa", "code"
    verification_prompt: Optional[str] = None  # User-friendly prompt
    current_url: str
    cdp_port: int
    execution_time_ms: int
    error: Optional[str] = None


# Singleton controller for sessions (keeps browser state)
_controller: Optional[BrowserController] = None


def get_controller() -> BrowserController:
    global _controller
    if _controller is None:
        _controller = BrowserController()
    return _controller


@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Start an AI-powered login session: Browser-Use launches Chrome with CDP,
    performs login, and keeps the browser open for Patchright to connect.

    Flow:
    1. Browser-Use launches Chrome with CDP enabled on port 9222
    2. Browser-Use performs the login task
    3. Browser stays open (not closed)
    4. Returns success status and CDP port
    5. Patchright connects to localhost:9222 to extract jobs
    6. Call /close when done
    """
    try:
        controller = get_controller()
        result = await controller.login(
            task=request.task,
            start_url=request.start_url,
            cdp_port=request.cdp_port,
            max_time=request.max_time,
            use_vision=request.use_vision,
            solve_captcha=request.solve_captcha,
        )
        return result
    except Exception as e:
        logger.error(f"Error starting login session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/close")
async def close_session():
    """
    Close the browser session.
    Call this after Patchright has finished extracting jobs.
    """
    try:
        controller = get_controller()
        result = await controller.close()
        return result
    except Exception as e:
        logger.error(f"Error closing session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Verification Endpoints
# =====================


class VerifyCodeRequest(BaseModel):
    """Request to submit a verification code"""

    task: str  # Task prompt from database
    code: str  # The verification code to enter
    cdp_port: Optional[int] = 9222
    max_time: Optional[int] = 60
    use_vision: Optional[bool] = True


class VerifyCodeResponse(BaseModel):
    """Response from verification code submission"""

    success: bool  # Whether the code was accepted
    login_complete: bool  # Whether login is now complete
    needs_new_code: bool  # Whether the code expired and a new one is needed
    captcha_needed: Optional[bool] = False  # CAPTCHA appeared, user must solve manually via VNC
    current_url: str
    execution_time_ms: int
    error: Optional[str] = None


class ResendCodeRequest(BaseModel):
    """Request to resend verification code"""

    task: str  # Task prompt from database
    cdp_port: Optional[int] = 9222
    max_time: Optional[int] = 30
    use_vision: Optional[bool] = True


class ResendCodeResponse(BaseModel):
    """Response from resend code request"""

    success: bool
    execution_time_ms: int
    error: Optional[str] = None


@app.post("/verify", response_model=VerifyCodeResponse)
async def submit_verification_code(request: VerifyCodeRequest):
    """
    Submit a verification code to continue login.

    Call this after /login returns verification_needed=True.
    The browser session remains open from the previous call.

    Flow:
    1. /login returns verification_needed=True
    2. User provides code (from email, SMS, or authenticator app)
    3. Call this endpoint with the code
    4. If login_complete=True, proceed with extraction
    5. If needs_new_code=True, call /resend-code and try again
    6. If success=False (invalid code), prompt user and retry
    """
    try:
        controller = get_controller()
        result = await controller.submit_verification_code(
            task=request.task,
            code=request.code,
            cdp_port=request.cdp_port,
            max_time=request.max_time,
            use_vision=request.use_vision,
        )
        return result
    except Exception as e:
        logger.error(f"Error submitting verification code: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resend-code", response_model=ResendCodeResponse)
async def resend_verification_code(request: ResendCodeRequest):
    """
    Request a new verification code.

    Call this when the verification code has expired.
    The browser will click the 'resend code' button on the page.
    """
    try:
        controller = get_controller()
        result = await controller.resend_verification_code(
            task=request.task,
            cdp_port=request.cdp_port,
            max_time=request.max_time,
            use_vision=request.use_vision,
        )
        return result
    except Exception as e:
        logger.error(f"Error resending verification code: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Session Management Endpoints
# =====================


class SessionCheckRequest(BaseModel):
    """Request to check if a session is valid (logged in)"""

    check_url: str  # URL to navigate to for login check
    login_url_pattern: str  # Pattern that indicates user is on login page (not logged in)
    cdp_port: Optional[int] = 9222


class SessionCheckResponse(BaseModel):
    """Response from session check"""

    session_exists: bool  # Whether session directory exists
    is_logged_in: bool  # Whether user is logged in (not redirected to login)
    current_url: str
    cdp_port: int


class SessionStartRequest(BaseModel):
    """Request to start browser with existing session (no login)"""

    start_url: str  # URL to navigate to
    cdp_port: Optional[int] = 9222


class SessionStartResponse(BaseModel):
    """Response from session start"""

    success: bool
    current_url: str
    cdp_port: int
    vnc_url: str  # VNC URL for manual intervention


class SessionWaitRequest(BaseModel):
    """Request to wait for manual login completion"""

    target_url_pattern: str  # Pattern indicating successful login (e.g., "/jobs", "/feed")
    cdp_port: Optional[int] = 9222
    timeout: Optional[int] = 300  # 5 minutes default
    poll_interval: Optional[int] = 5  # Check every 5 seconds


class SessionWaitResponse(BaseModel):
    """Response from session wait"""

    success: bool  # Whether login was detected
    current_url: str
    timed_out: bool


@app.post("/session/check", response_model=SessionCheckResponse)
async def check_session(request: SessionCheckRequest):
    """
    Check if the persistent session is logged in.

    Launches browser with existing session, navigates to check_url,
    and determines if user is logged in based on URL pattern.

    If current URL contains login_url_pattern, user is NOT logged in.
    """
    try:
        controller = get_controller()
        result = await controller.check_session(
            check_url=request.check_url,
            login_url_pattern=request.login_url_pattern,
            cdp_port=request.cdp_port,
        )
        return result
    except Exception as e:
        logger.error(f"Error checking session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/start", response_model=SessionStartResponse)
async def start_session(request: SessionStartRequest):
    """
    Start browser with existing persistent session (no login attempt).

    Use this to launch the browser for manual login or when you want
    to use an existing session without checking login status.
    """
    try:
        controller = get_controller()
        result = await controller.start_session(
            start_url=request.start_url,
            cdp_port=request.cdp_port,
        )
        return result
    except Exception as e:
        logger.error(f"Error starting session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/wait", response_model=SessionWaitResponse)
async def wait_for_login(request: SessionWaitRequest):
    """
    Wait for manual login completion by polling the current URL.

    Polls every poll_interval seconds to check if current URL
    matches target_url_pattern, indicating successful login.

    Use this after /session/start to wait for user to complete
    manual login via VNC.
    """
    try:
        controller = get_controller()
        result = await controller.wait_for_login(
            target_url_pattern=request.target_url_pattern,
            cdp_port=request.cdp_port,
            timeout=request.timeout,
            poll_interval=request.poll_interval,
        )
        return result
    except Exception as e:
        logger.error(f"Error waiting for login: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
