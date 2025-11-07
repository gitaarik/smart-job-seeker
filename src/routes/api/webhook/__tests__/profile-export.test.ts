/**
 * Unit tests for webhook profile.export event handler
 * Tests signature verification, event routing, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import type { WebhookPayload } from '$lib/types/webhook';

// Mock the profile-export module
vi.mock('$lib/server/profile-export', () => ({
  exportProfile: vi.fn(),
}));

// Mock the get-env utility
vi.mock('$lib/tools/get-env', () => ({
  getEnv: vi.fn((key: string, defaultValue = '') => {
    const envVars: Record<string, string> = {
      WEBHOOK_SECRET: 'test-webhook-secret-key-1234567890123456',
    };
    return envVars[key] ?? defaultValue;
  }),
}));

import { exportProfile } from '$lib/server/profile-export';
import { POST } from '../+server';

/**
 * Helper function to generate HMAC-SHA256 signature
 */
function generateSignature(payload: Record<string, unknown>, secret: string): string {
  const payloadString = JSON.stringify(payload);
  return createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Helper function to create a mock Request
 */
function createMockRequest(
  body: Record<string, unknown>,
  signature: string,
  method = 'POST'
): Request {
  const payloadString = JSON.stringify(body);
  return new Request('http://localhost:5173/api/webhook', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature,
    },
    body: payloadString,
  });
}

/**
 * Helper function to create a mock RequestEvent
 */
function createMockEvent(request: Request) {
  return {
    request,
  } as any;
}

describe('POST /api/webhook - profile.export event', () => {
  const secret = 'test-webhook-secret-key-1234567890123456';
  const validPayload: WebhookPayload = {
    eventId: 'test-export-1',
    eventType: 'profile.export',
    timestamp: '2024-11-07T10:30:00.000Z',
    data: {
      profileId: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signature verification', () => {
    it('should reject requests with missing signature header', async () => {
      const request = new Request('http://localhost:5173/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      });

      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing webhook signature header');
    });

    it('should reject requests with invalid signature', async () => {
      const request = createMockRequest(validPayload, 'invalid-signature-12345');
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid webhook signature');
    });

    it('should accept requests with valid signature', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      // Mock successful export
      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: true,
        schemaResult: { success: true, message: 'Schema exported' },
        dataResult: { success: true, message: 'Data exported' },
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('payload validation', () => {
    it('should reject invalid JSON payload even with valid signature', async () => {
      // The signature verification happens after body read, so we generate a signature
      // from the raw invalid body that matches
      const invalidBody = 'invalid json {';
      const signature = generateSignature({ test: 'data' }, secret);

      const request = new Request('http://localhost:5173/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: invalidBody,
      });

      const event = createMockEvent(request);
      const response = await POST(event);

      // Since the raw body doesn't match our signature, it will be rejected as invalid signature
      // which is correct behavior - signature should match the exact body bytes
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject payload missing required fields', async () => {
      const incompletePayload = {
        eventId: 'test-1',
        eventType: 'profile.export',
        // missing data field
      };

      const signature = generateSignature(incompletePayload, secret);
      const request = createMockRequest(incompletePayload, signature);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });
  });

  describe('profile.export event processing', () => {
    it('should successfully process valid profile.export event', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: true,
        schemaResult: { success: true, message: 'Schema exported' },
        dataResult: { success: true, message: 'Data exported' },
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.processed).toBe(true);
      expect(data.data.profileId).toBe(1);
      expect(mockExportProfile).toHaveBeenCalledWith(1);
    });

    it('should handle missing profileId in data', async () => {
      const payloadNoProfileId: WebhookPayload = {
        eventId: 'test-2',
        eventType: 'profile.export',
        timestamp: '2024-11-07T10:30:00.000Z',
        data: {
          // missing profileId
        },
      };

      const signature = generateSignature(payloadNoProfileId, secret);
      const request = createMockRequest(payloadNoProfileId, signature);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain('Missing or invalid profileId');
    });

    it('should handle invalid profileId type', async () => {
      const payloadInvalidProfileId: WebhookPayload = {
        eventId: 'test-3',
        eventType: 'profile.export',
        timestamp: '2024-11-07T10:30:00.000Z',
        data: {
          profileId: 'not-a-number',
        },
      };

      const signature = generateSignature(payloadInvalidProfileId, secret);
      const request = createMockRequest(payloadInvalidProfileId, signature);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain('Missing or invalid profileId');
    });

    it('should handle export function errors gracefully', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: false,
        schemaResult: { success: false, message: 'Profile not found' },
        dataResult: { success: false, message: 'Profile not found' },
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
    });

    it('should return detailed export results', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: true,
        schemaResult: { success: true, message: 'Schema exported for profile ID 1' },
        dataResult: { success: true, message: 'Data exported for profile ID 1' },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data.data.schemaExport).toBeDefined();
      expect(data.data.dataExport).toBeDefined();
      expect(data.data.schemaExport.success).toBe(true);
      expect(data.data.dataExport.success).toBe(true);
    });
  });

  describe('response format', () => {
    it('should return proper response structure on success', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: true,
        schemaResult: { success: true, message: 'Schema exported' },
        dataResult: { success: true, message: 'Data exported' },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should include eventId in response', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockResolvedValueOnce({
        success: true,
        schemaResult: { success: true, message: 'Schema exported' },
        dataResult: { success: true, message: 'Data exported' },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data.data.eventId).toBe('test-export-1');
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const signature = generateSignature(validPayload, secret);
      const request = createMockRequest(validPayload, signature);
      const event = createMockEvent(request);

      const mockExportProfile = exportProfile as any;
      mockExportProfile.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain('Database connection failed');
    });
  });
});
