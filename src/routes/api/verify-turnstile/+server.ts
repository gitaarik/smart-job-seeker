import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getEnv } from "$lib/tools/get-env";

export const POST: RequestHandler = async ({ request }) => {
  // Parse request body (try block for async operation)
  let token;
  try {
    const body = await request.json();
    token = body.token;
  } catch (error) {
    return json({ success: false, error: "Invalid request body" }, {
      status: 400,
    });
  }

  // Validation outside try block
  if (!token) {
    return json({ success: false, error: "No token provided" }, {
      status: 400,
    });
  }

  // Get environment variable (throws if not set, which is intentional)
  const turnstileSecret = getEnv("SJS_TURNSTILE_SECRET_KEY");

  if (!turnstileSecret) {
    throw new Error("SJS_TURNSTILE_SECRET_KEY env var unset");
  }

  // Verify with Cloudflare (try block for async operations)
  let verifyResponse;
  let verifyData;
  try {
    verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token,
        }),
      },
    );

    verifyData = await verifyResponse.json();
  } catch (error) {
    console.error("Error verifying Turnstile:", error);
    return json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }

  // Response construction outside try block
  if (verifyData.success) {
    return json({
      success: true,
      challenge_ts: verifyData.challenge_ts,
      hostname: verifyData.hostname,
    });
  } else {
    return json({
      success: false,
      error: "Turnstile verification failed",
      "error-codes": verifyData["error-codes"] || [],
    }, { status: 400 });
  }
};
