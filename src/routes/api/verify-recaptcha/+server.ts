import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Your reCAPTCHA secret key (keep this secure!)
const RECAPTCHA_SECRET_KEY = '6LeAGHorAAAAAA5ItH3NGH2wEzjhQEjOti8ZzXQh';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token, action } = await request.json();

    if (!token) {
      return json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    // Verify the reCAPTCHA token with Google
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      // For reCAPTCHA v3, check the score and action
      const score = verifyData.score || 0;
      const receivedAction = verifyData.action || '';

      // Score should be between 0.0 and 1.0 (1.0 being very likely human)
      // You can adjust this threshold based on your needs
      const scoreThreshold = 0.5;

      if (score >= scoreThreshold && receivedAction === action) {
        return json({ success: true, score });
      } else {
        return json({
          success: false,
          error: 'Verification failed',
          score,
          action: receivedAction
        }, { status: 400 });
      }
    } else {
      return json({
        success: false,
        error: 'reCAPTCHA verification failed',
        details: verifyData['error-codes'] || []
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
};
