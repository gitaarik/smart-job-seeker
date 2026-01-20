"""
Unit tests for the detection module.
"""

import pytest
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from detection import (
    is_captcha_page,
    detect_verification_required,
    is_on_auth_page,
    is_on_success_page,
    parse_verification_result,
)


class TestIsCaptchaPage:
    """Tests for CAPTCHA detection."""

    def test_recaptcha_detected(self):
        assert is_captcha_page("please complete the recaptcha to continue") is True

    def test_hcaptcha_detected(self):
        assert is_captcha_page("verify with hcaptcha") is True

    def test_human_verification_detected(self):
        assert is_captcha_page("verify you are human") is True

    def test_cloudflare_detected(self):
        assert is_captcha_page("checking your browser. cloudflare") is True

    def test_not_a_robot_detected(self):
        assert is_captcha_page("please confirm you're not a robot") is True

    def test_turnstile_detected(self):
        assert is_captcha_page("complete the turnstile challenge") is True

    def test_security_check_detected(self):
        assert is_captcha_page("security check required") is True

    def test_normal_page_not_flagged(self):
        assert is_captcha_page("welcome to your dashboard") is False

    def test_job_listing_not_flagged(self):
        assert is_captcha_page("software engineer position at acme corp") is False

    def test_login_form_not_flagged(self):
        assert is_captcha_page("enter your email and password to sign in") is False

    def test_case_insensitive(self):
        assert is_captcha_page("VERIFY YOU ARE HUMAN") is True
        assert is_captcha_page("ReCAPTCHA") is True


class TestDetectVerificationRequired:
    """Tests for verification code detection."""

    def test_email_verification_check_email(self):
        needed, vtype, prompt = detect_verification_required("check your email for a code")
        assert needed is True
        assert vtype == "email"
        assert "email" in prompt.lower()

    def test_email_verification_sent_to_email(self):
        needed, vtype, prompt = detect_verification_required("we sent a code to your email")
        assert needed is True
        assert vtype == "email"

    def test_sms_verification_check_phone(self):
        needed, vtype, prompt = detect_verification_required("check your phone for the code")
        assert needed is True
        assert vtype == "sms"
        assert "phone" in prompt.lower() or "sms" in prompt.lower()

    def test_sms_verification_text_message(self):
        needed, vtype, prompt = detect_verification_required("we sent a text message with your code")
        assert needed is True
        assert vtype == "sms"

    def test_2fa_authenticator_app(self):
        needed, vtype, prompt = detect_verification_required("enter code from your authenticator app")
        assert needed is True
        assert vtype == "2fa"
        assert "2fa" in prompt.lower() or "authenticator" in prompt.lower()

    def test_2fa_google_authenticator(self):
        needed, vtype, prompt = detect_verification_required("enter the code from google authenticator")
        assert needed is True
        assert vtype == "2fa"

    def test_2fa_two_factor(self):
        needed, vtype, prompt = detect_verification_required("two-factor authentication required")
        assert needed is True
        assert vtype == "2fa"

    def test_generic_otp(self):
        needed, vtype, prompt = detect_verification_required("enter your one-time password")
        assert needed is True
        assert vtype == "code"

    def test_no_verification_dashboard(self):
        needed, vtype, prompt = detect_verification_required("welcome to your account dashboard")
        assert needed is False
        assert vtype is None
        assert prompt is None

    def test_no_verification_job_listing(self):
        needed, vtype, prompt = detect_verification_required("senior developer position available")
        assert needed is False

    def test_case_insensitive(self):
        needed, vtype, prompt = detect_verification_required("CHECK YOUR EMAIL FOR A CODE")
        assert needed is True
        assert vtype == "email"


class TestIsOnAuthPage:
    """Tests for auth page URL detection."""

    def test_login_page(self):
        assert is_on_auth_page("https://example.com/login") is True

    def test_signin_page(self):
        assert is_on_auth_page("https://example.com/signin") is True

    def test_verify_page(self):
        assert is_on_auth_page("https://example.com/verify") is True

    def test_2fa_page(self):
        assert is_on_auth_page("https://example.com/2fa") is True

    def test_challenge_page(self):
        assert is_on_auth_page("https://example.com/challenge/code") is True

    def test_dashboard_not_auth(self):
        assert is_on_auth_page("https://example.com/dashboard") is False

    def test_jobs_not_auth(self):
        assert is_on_auth_page("https://example.com/jobs") is False

    def test_case_insensitive(self):
        assert is_on_auth_page("https://example.com/LOGIN") is True


class TestIsOnSuccessPage:
    """Tests for success page URL detection."""

    def test_jobs_page(self):
        assert is_on_success_page("https://example.com/jobs") is True

    def test_search_page(self):
        assert is_on_success_page("https://example.com/search?q=developer") is True

    def test_dashboard_page(self):
        assert is_on_success_page("https://example.com/dashboard") is True

    def test_feed_page(self):
        assert is_on_success_page("https://linkedin.com/feed") is True

    def test_query_param(self):
        assert is_on_success_page("https://example.com/search?query=python") is True

    def test_login_not_success(self):
        assert is_on_success_page("https://example.com/login") is False

    def test_verify_not_success(self):
        assert is_on_success_page("https://example.com/verify") is False


class TestParseVerificationResult:
    """Tests for verification result parsing."""

    def test_success_result(self):
        class MockResult:
            def final_result(self):
                return "SUCCESS: Login completed"
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert success is True
        assert login_complete is True
        assert needs_new_code is False
        assert captcha_needed is False

    def test_invalid_code_result(self):
        class MockResult:
            def final_result(self):
                return "INVALID_CODE: The code was incorrect"
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert success is False
        assert login_complete is False

    def test_needs_new_code_result(self):
        class MockResult:
            def final_result(self):
                return "NEEDS_NEW_CODE: Code has expired"
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert success is False
        assert needs_new_code is True

    def test_expired_code_result(self):
        class MockResult:
            def final_result(self):
                return "EXPIRED: Please request a new code"
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert needs_new_code is True

    def test_captcha_needed_result(self):
        class MockResult:
            def final_result(self):
                return "CAPTCHA_NEEDED: Human verification required"
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert captcha_needed is True
        assert success is False

    def test_no_final_result(self):
        class MockResult:
            history = []

        success, login_complete, needs_new_code, captcha_needed = parse_verification_result(MockResult())
        assert success is False
        assert login_complete is False
        assert needs_new_code is False
        assert captcha_needed is False
