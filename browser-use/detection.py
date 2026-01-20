"""
Detection module for Browser-Use.

Detects CAPTCHA challenges and verification code requirements from page content.
"""

import re
from typing import Tuple, Optional

# Patterns that indicate a CAPTCHA challenge (should NOT trigger verification_needed)
CAPTCHA_PATTERNS = [
    r'verify you are human',
    r'verify you.re human',
    r'i.m not a robot',
    r'not a robot',
    r'security check',
    r'cloudflare',
    r'turnstile',
    r'recaptcha',
    r'hcaptcha',
    r'prove you.re human',
    r'confirm you.re human',
    r'human verification',
    r'bot detection',
]

# Patterns that indicate verification CODE is needed (email, SMS, 2FA)
VERIFICATION_PATTERNS = {
    'email': [
        r'check your email',
        r'sent.*code.*email',
        r'sent to your email',
        r'email.*code',
        r'we sent you',
        r'we.ve sent',
    ],
    'sms': [
        r'check your phone',
        r'sent.*code.*phone',
        r'sent to your phone',
        r'sms.*code',
        r'text message',
    ],
    '2fa': [
        r'two-factor',
        r'2fa',
        r'authenticator app',
        r'authentication app',
        r'google authenticator',
        r'authy',
    ],
    'code': [
        r'enter the code we sent',
        r'enter your code',
        r'verification code sent',
        r'one-time password',
        r'otp',
    ],
}

# User-friendly prompts for each verification type
VERIFICATION_PROMPTS = {
    'email': "Please check your email for a verification code",
    'sms': "Please check your phone for an SMS verification code",
    '2fa': "Please enter your 2FA/authenticator code",
    'code': "Please enter the verification code",
}

# URL patterns that indicate auth/login pages
AUTH_URL_PATTERNS = [
    '/auth',
    '/login',
    '/signin',
    '/verify',
    '/challenge',
    '/2fa',
    '/mfa',
    '/otp',
]

# URL patterns that indicate successful login
SUCCESS_URL_PATTERNS = [
    '/jobs',
    '/search',
    '/results',
    '/dashboard',
    '/feed',
    '/home',
    'q=',
    'query=',
]


def is_captcha_page(page_text: str) -> bool:
    """
    Detect if page shows a CAPTCHA challenge.

    Args:
        page_text: Lowercase page body text

    Returns:
        True if CAPTCHA patterns are detected
    """
    page_text_lower = page_text.lower()
    return any(re.search(pattern, page_text_lower) for pattern in CAPTCHA_PATTERNS)


def detect_verification_required(page_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Detect if a verification code is required.

    This detects actual verification CODES (email, SMS, 2FA) that require
    user input, NOT CAPTCHA challenges that the agent should solve.

    Args:
        page_text: Lowercase page body text

    Returns:
        Tuple of (needed, verification_type, user_prompt)
        - needed: True if verification code is required
        - verification_type: "email", "sms", "2fa", or "code"
        - user_prompt: User-friendly message about what to do
    """
    page_text_lower = page_text.lower()

    for vtype, patterns in VERIFICATION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, page_text_lower):
                prompt = VERIFICATION_PROMPTS.get(vtype, VERIFICATION_PROMPTS['code'])
                return True, vtype, prompt

    return False, None, None


def is_on_auth_page(url: str) -> bool:
    """
    Check if URL indicates an auth/login page.

    Args:
        url: Current page URL

    Returns:
        True if URL contains auth-related patterns
    """
    url_lower = url.lower()
    return any(pattern in url_lower for pattern in AUTH_URL_PATTERNS)


def is_on_success_page(url: str) -> bool:
    """
    Check if URL indicates successful login (dashboard, jobs, etc.).

    Args:
        url: Current page URL

    Returns:
        True if URL contains success patterns
    """
    url_lower = url.lower()
    return any(pattern in url_lower for pattern in SUCCESS_URL_PATTERNS)


def check_agent_result_for_captcha(result) -> bool:
    """
    Check if Browser-Use agent reported CAPTCHA_NEEDED.

    Args:
        result: Agent result object

    Returns:
        True if agent explicitly reported CAPTCHA
    """
    if hasattr(result, 'final_result'):
        final_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()
        return 'CAPTCHA_NEEDED' in final_text
    return False


def check_agent_result_for_verification(result) -> bool:
    """
    Check if Browser-Use agent reported VERIFICATION_NEEDED.

    Args:
        result: Agent result object

    Returns:
        True if agent explicitly reported verification needed
    """
    if not hasattr(result, 'history') or not result.history:
        return False

    for item in reversed(result.history[-5:]):
        if hasattr(item, 'model_output') and item.model_output:
            output = item.model_output
            if hasattr(output, 'action') and output.action:
                for action in output.action:
                    if hasattr(action, 'done') and action.done:
                        done_text = getattr(action.done, 'text', '').upper()
                        if 'VERIFICATION_NEEDED' in done_text:
                            return True
    return False


def check_agent_result_for_success(result) -> bool:
    """
    Check if Browser-Use agent reported success.

    Args:
        result: Agent result object

    Returns:
        True if agent completed successfully
    """
    if not hasattr(result, 'history') or not result.history:
        return False

    for item in reversed(result.history[-5:]):
        if hasattr(item, 'model_output') and item.model_output:
            output = item.model_output
            if hasattr(output, 'action') and output.action:
                for action in output.action:
                    if hasattr(action, 'done') and action.done:
                        if getattr(action.done, 'success', False):
                            return True

        if hasattr(item, 'result') and item.result:
            for step_result in item.result:
                if hasattr(step_result, 'extracted_content'):
                    content = str(step_result.extracted_content).lower()
                    if 'success' in content or 'logged in' in content or 'job' in content:
                        return True
                if hasattr(step_result, 'done') and step_result.done:
                    if getattr(step_result, 'success', False):
                        return True

    return False


def parse_verification_result(result) -> Tuple[bool, bool, bool, bool]:
    """
    Parse verification code submission result.

    Args:
        result: Agent result object

    Returns:
        Tuple of (success, login_complete, needs_new_code, captcha_needed)
    """
    success = False
    login_complete = False
    needs_new_code = False
    captcha_needed = False

    # Get final result text
    final_result_text = ""
    if hasattr(result, 'final_result'):
        final_result_text = str(result.final_result()).upper() if callable(result.final_result) else str(result.final_result).upper()

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

    return success, login_complete, needs_new_code, captcha_needed
