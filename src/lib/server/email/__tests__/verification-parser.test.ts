import { describe, expect, it } from "vitest";
import { parseVerificationEmail } from "../verification-parser";

describe("parseVerificationEmail", () => {
  describe("OTP code extraction", () => {
    it("extracts 'Your verification code is: 123456'", async () => {
      const result = await parseVerificationEmail(
        "Verify your login",
        "Your verification code is: 123456",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("123456");
      expect(result!.confidence).toBe("high");
    });

    it("extracts 'Enter code 789012'", async () => {
      const result = await parseVerificationEmail(
        null,
        "Please enter code 789012 to verify your account.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("789012");
    });

    it("extracts '654321 is your verification code'", async () => {
      const result = await parseVerificationEmail(
        null,
        "654321 is your verification code for LinkedIn.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("654321");
    });

    it("extracts code from subject line", async () => {
      const result = await parseVerificationEmail(
        "Your verification code is: 112233",
        "Please use the code above to verify.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("112233");
    });

    it("extracts alphanumeric code 'A1B-2C3'", async () => {
      const result = await parseVerificationEmail(
        null,
        "Your security code is: A1B-2C3",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("A1B2C3");
    });

    it("extracts standalone 6-digit code as low confidence", async () => {
      const result = await parseVerificationEmail(
        null,
        "Here is some text with 998877 in the middle.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("998877");
    });
  });

  describe("verification link extraction", () => {
    it("extracts verify link from plain text", async () => {
      const result = await parseVerificationEmail(
        "Verify your email",
        "Click here to verify: https://example.com/verify?token=abc123",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.link).toBe("https://example.com/verify?token=abc123");
      expect(result!.confidence).toBe("high");
    });

    it("extracts magic link from HTML href", async () => {
      const result = await parseVerificationEmail(
        "Sign in to LinkedIn",
        null,
        '<html><body><a href="https://linkedin.com/auth/magic-link?token=xyz789">Click to sign in</a></body></html>',
      );
      expect(result).not.toBeNull();
      expect(result!.link).toBe("https://linkedin.com/auth/magic-link?token=xyz789");
    });

    it("ignores unsubscribe links", async () => {
      const result = await parseVerificationEmail(
        "Verify your account",
        "Visit https://example.com/verify?code=abc and click confirm.\nTo unsubscribe: https://example.com/unsubscribe?id=123",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.link).toBe("https://example.com/verify?code=abc");
      expect(result!.link).not.toContain("unsubscribe");
    });

    it("ignores image URLs", async () => {
      const result = await parseVerificationEmail(
        null,
        null,
        '<html><body><img src="https://example.com/logo.png" /><a href="https://example.com/confirm?token=def">Confirm</a></body></html>',
      );
      expect(result).not.toBeNull();
      expect(result!.link).toBe("https://example.com/confirm?token=def");
    });
  });

  describe("combined code and link", () => {
    it("extracts both code and link when present", async () => {
      const result = await parseVerificationEmail(
        "Your verification code",
        "Your verification code is: 445566\n\nOr click here: https://example.com/verify?token=abc",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("445566");
      expect(result!.link).toBe("https://example.com/verify?token=abc");
    });
  });

  describe("no verification data", () => {
    it("returns null for plain marketing email", async () => {
      const result = await parseVerificationEmail(
        "50% off sale!",
        "Don't miss our amazing sale. Shop now at https://store.example.com/sale",
        null,
      );
      // The store URL doesn't match verification patterns
      expect(result?.link).toBeUndefined();
    });

    it("returns null for empty content", async () => {
      const result = await parseVerificationEmail(null, null, null);
      expect(result).toBeNull();
    });
  });

  describe("real-world email formats", () => {
    it("handles LinkedIn verification email", async () => {
      const result = await parseVerificationEmail(
        "LinkedIn: Your verification code is 847293",
        "Hi User,\n\nYour verification code is: 847293\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("847293");
      expect(result!.confidence).toBe("high");
    });

    it("handles Indeed magic link email", async () => {
      const result = await parseVerificationEmail(
        "Sign in to Indeed",
        null,
        `<html><body>
          <p>Click the button below to sign in to Indeed:</p>
          <a href="https://secure.indeed.com/auth/verify?token=abcdef123456&email=user@example.com" style="background:blue;color:white;padding:10px">Sign In</a>
          <p>This link expires in 15 minutes.</p>
          <p><a href="https://www.indeed.com/unsubscribe?id=xyz">Unsubscribe</a></p>
        </body></html>`,
      );
      expect(result).not.toBeNull();
      expect(result!.link).toContain("indeed.com/auth/verify");
      expect(result!.link).not.toContain("unsubscribe");
    });

    it("handles Glassdoor OTP email", async () => {
      const result = await parseVerificationEmail(
        "Your Glassdoor security code",
        "Use code 9281 to sign in to your Glassdoor account.\n\nThis code will expire in 5 minutes.",
        null,
      );
      expect(result).not.toBeNull();
      expect(result!.code).toBe("9281");
    });
  });
});
