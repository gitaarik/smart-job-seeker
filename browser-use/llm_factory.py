"""
LLM Factory module for Browser-Use.

Creates LLM instances based on provider configuration from environment variables.
"""

import os
import logging
from typing import Tuple, Any

from langchain_groq import ChatGroq
from langchain_cerebras import ChatCerebras
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from browser_use import ChatBrowserUse

logger = logging.getLogger(__name__)

# Default models per provider
DEFAULT_MODELS = {
    "groq": "llama-3.3-70b-versatile",
    "cerebras": "llama-3.3-70b",
    "gemini": "gemini-2.0-flash-exp",
    "openai": "gpt-4o",
    "deepseek": "deepseek-chat",
    "browser_use": None,  # Uses their optimized model automatically
}

# Provider-specific environment variable names for model selection
PROVIDER_MODEL_ENV_VARS = {
    "groq": "SJS_LLM_MODEL_GROQ",
    "cerebras": "SJS_LLM_MODEL_CEREBRAS",
    "gemini": "SJS_LLM_MODEL_GEMINI",
    "openai": "SJS_LLM_MODEL_OPENAI",
    "deepseek": "SJS_LLM_MODEL_DEEPSEEK",
}


def _get_model_for_provider(provider: str) -> str:
    """Get model name for provider with priority: env var > default."""
    hardcoded_default = DEFAULT_MODELS.get(provider, DEFAULT_MODELS["groq"])
    provider_env_var = PROVIDER_MODEL_ENV_VARS.get(provider)

    if provider_env_var:
        model = os.getenv(provider_env_var, hardcoded_default)
        # Handle empty string from environment variables
        return model if model else hardcoded_default

    return hardcoded_default


def _create_groq_llm(model: str) -> Tuple[Any, bool]:
    """Create Groq LLM instance."""
    llm = ChatGroq(
        model=model,
        api_key=os.getenv("SJS_LLM_API_KEY_GROQ"),
        temperature=0.3,
    )
    return llm, False  # Groq doesn't support vision


def _create_gemini_llm(model: str) -> Tuple[Any, bool]:
    """Create Google Gemini LLM instance."""
    llm = ChatGoogleGenerativeAI(
        model=model,
        api_key=os.getenv("SJS_LLM_API_KEY_GEMINI"),
        temperature=0.3,
    )
    return llm, True  # Gemini supports vision


def _create_openai_llm(model: str) -> Tuple[Any, bool]:
    """Create OpenAI LLM instance."""
    llm = ChatOpenAI(
        model=model,
        api_key=os.getenv("SJS_LLM_API_KEY_OPENAI"),
        temperature=0.3,
    )
    return llm, True  # GPT-4o supports vision


def _create_deepseek_llm(model: str) -> Tuple[Any, bool]:
    """Create DeepSeek LLM instance."""
    llm = ChatOpenAI(
        model=model,
        base_url="https://api.deepseek.com",
        api_key=os.getenv("SJS_LLM_API_KEY_DEEPSEEK"),
        temperature=0.3,
    )
    return llm, "v3" in model  # DeepSeek v3 supports vision


def _create_cerebras_llm(model: str) -> Tuple[Any, bool]:
    """Create Cerebras LLM instance."""
    llm = ChatCerebras(
        model=model,
        api_key=os.getenv("SJS_LLM_API_KEY_CEREBRAS"),
        temperature=0.3,
    )
    return llm, False  # Cerebras doesn't support vision


def _create_browser_use_llm() -> Tuple[Any, bool]:
    """Create Browser-Use cloud LLM instance."""
    api_key = os.getenv("SJS_LLM_API_KEY_BROWSER_USE") or os.getenv("BROWSER_USE_API_KEY")

    if not api_key:
        raise ValueError(
            "Browser-Use API key not found. Set SJS_LLM_API_KEY_BROWSER_USE or BROWSER_USE_API_KEY. "
            "Get a key at: https://cloud.browser-use.com/new-api-key"
        )

    model = os.getenv("SJS_LLM_MODEL_BROWSER_USE") or "browser-use/bu-30b-a3b-preview"
    llm = ChatBrowserUse(model=model, api_key=api_key)

    logger.info(f"[Browser-Use] Using Browser-Use cloud LLM: {model}")
    print(f"[Browser-Use] Using Browser-Use cloud LLM: {model}", flush=True)

    return llm, True  # Browser-Use cloud supports vision


def create_llm(provider: str | None = None) -> Tuple[Any, bool]:
    """
    Create an LLM instance based on provider configuration.

    Args:
        provider: LLM provider name. If None, reads from environment.

    Returns:
        Tuple of (llm_instance, supports_vision)
    """
    if provider is None:
        provider = os.getenv(
            "SJS_LLM_PROVIDER_BROWSER_USE",
            os.getenv("SJS_LLM_PROVIDER", "groq")
        ).lower()

    logger.info(f"[Browser-Use] Initializing with provider: {provider}")
    print(f"[Browser-Use] Initializing with provider: {provider}", flush=True)

    model = _get_model_for_provider(provider)

    logger.info(f"[Browser-Use] Using model: {model}")
    print(f"[Browser-Use] Using model: {model}", flush=True)

    # Provider dispatch
    if provider == "gemini":
        return _create_gemini_llm(model)
    elif provider == "openai":
        return _create_openai_llm(model)
    elif provider == "deepseek":
        return _create_deepseek_llm(model)
    elif provider == "cerebras":
        return _create_cerebras_llm(model)
    elif provider == "browser_use":
        return _create_browser_use_llm()
    else:
        # Default to Groq
        return _create_groq_llm(model)
