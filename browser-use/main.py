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
