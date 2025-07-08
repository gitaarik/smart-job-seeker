import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Your Cloudflare Turnstile secret key (keep this secure!)
const TURNSTILE_SECRET_KEY = '0x4AAAAAABkW4r42MikTFiY2ZV-IaGmrThM';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token } = await request.json();

    if (!token) {
      return json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    // Verify the Turnstile token with Cloudflare
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      // Turnstile verification successful
      return json({
        success: true,
        challenge_ts: verifyData.challenge_ts,
        hostname: verifyData.hostname
      });
    } else {
      // Turnstile verification failed
      return json({
        success: false,
        error: 'Turnstile verification failed',
        'error-codes': verifyData['error-codes'] || []
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error verifying Turnstile:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
};
