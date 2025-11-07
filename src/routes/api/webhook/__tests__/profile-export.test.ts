/**
 * Unit tests for webhook profile.export event handler
 * Tests secret verification, event routing, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
 * Helper function to create a mock Request
 */
function createMockRequest(
  body: Record<string, unknown>,
  secret: string,
  method = 'POST'
): Request {
  const payloadString = JSON.stringify(body);
  return new Request('http://localhost:5173/api/webhook', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': secret,
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
    eventType: 'profile.export',
    data: {
      profileId: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('secret verification', () => {
    it('should reject requests with missing secret header', async () => {
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
      expect(data.error).toContain('Missing webhook secret header');
    });

    it('should reject requests with invalid secret', async () => {
      const request = createMockRequest(validPayload, 'invalid-secret-key');
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid webhook secret');
    });

    it('should accept requests with valid secret', async () => {
      const request = createMockRequest(validPayload, secret);
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
    it('should reject invalid JSON payload', async () => {
      const invalidBody = 'invalid json {';

      const request = new Request('http://localhost:5173/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': secret,
        },
        body: invalidBody,
      });

      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to parse request body as JSON');
    });

    it('should reject payload missing required fields', async () => {
      const incompletePayload = {
        eventType: 'profile.export',
        // missing data field
      };

      const request = createMockRequest(incompletePayload, secret);
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
      const request = createMockRequest(validPayload, secret);
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
        eventType: 'profile.export',
        data: {
          // missing profileId
        },
      };

      const request = createMockRequest(payloadNoProfileId, secret);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain('Missing or invalid profileId');
    });

    it('should handle invalid profileId type', async () => {
      const payloadInvalidProfileId: WebhookPayload = {
        eventType: 'profile.export',
        data: {
          profileId: 'not-a-number',
        },
      };

      const request = createMockRequest(payloadInvalidProfileId, secret);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain('Missing or invalid profileId');
    });

    it('should handle export function errors gracefully', async () => {
      const request = createMockRequest(validPayload, secret);
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
      const request = createMockRequest(validPayload, secret);
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
      const request = createMockRequest(validPayload, secret);
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
    });

  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const request = createMockRequest(validPayload, secret);
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
