# Webhook Integration Guide

This document explains how to set up and use the secure webhook endpoint for Directus Flow integration.

## Overview

The webhook endpoint (`POST /api/webhook`) allows Directus Flow scripts to securely send data to your SvelteKit application. The integration uses HMAC-SHA256 signature verification to ensure requests are authentic.

## Setup

### 1. Generate Webhook Secret

Generate a secure random webhook secret key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output example:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f
```

### 2. Configure Environment Variable

Add the generated secret to your `.env` file (or `.env.me` for local development):

```
WEBHOOK_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f"
```

For production, add to `.env.production`:

```
WEBHOOK_SECRET="your-production-webhook-secret-key"
```

## Webhook Endpoint

**URL:** `POST http://localhost:5173/api/webhook` (development)

**Production URL:** Replace with your production domain

## Request Format

Send a POST request with the following structure:

### Headers

```
Content-Type: application/json
x-webhook-signature: <HMAC-SHA256 signature>
```

The signature is an HMAC-SHA256 hex digest of the raw JSON body using your `WEBHOOK_SECRET` as the key.

### Body

```json
{
  "eventType": "profile.export|item.create|item.update|item.delete|custom.event",
  "data": {
    "id": "some-id",
    "field1": "value1",
    "field2": "value2"
  }
}
```

### Payload Fields

- **eventType** (required): Type of event (`profile.export`, `item.create`, `item.update`, `item.delete`, or custom)
- **data** (required): The actual payload data

## Response Format

### Success Response (HTTP 200)

```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "processed": true,
    "action": "item.create",
    "itemId": "item-123"
  }
}
```

### Error Response (HTTP 401/400/500)

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Invalid webhook signature"
}
```

## Directus Flow Integration

### Step 1: Create a Flow Script

1. Go to Directus Admin Panel → Settings → Flows
2. Click "Create Flow"
3. Choose trigger (e.g., "Item Created")
4. Add an operation of type "Webhook" or "Run Script"

### Step 2: Configure the Webhook Operation

If using a Webhook operation:

1. Set the URL: `http://localhost:5173/api/webhook` (or your production URL)
2. Set method to `POST`
3. Add headers:
   ```
   Content-Type: application/json
   x-webhook-signature: <see Step 3>
   ```

### Step 3: Generate and Sign the Payload

You need to generate the HMAC-SHA256 signature of the payload.

**Using a Run Script operation in Directus Flow:**

```javascript
// In Directus Flow Script operation
const crypto = require('crypto');
const webhook_secret = 'your-webhook-secret-key';

// Build your payload
const payload = {
  eventId: $trigger.key || crypto.randomUUID(),
  eventType: 'item.create',
  timestamp: new Date().toISOString(),
  data: {
    id: $trigger.body?.id,
    name: $trigger.body?.name,
    // ... include relevant fields from the trigger
  },
  metadata: {
    collection: 'your_collection',
    userId: $trigger.body?.user_created
  }
};

// Convert to JSON string
const payloadString = JSON.stringify(payload);

// Generate HMAC-SHA256 signature
const signature = crypto
  .createHmac('sha256', webhook_secret)
  .update(payloadString)
  .digest('hex');

// Return for use in webhook operation
return {
  payload: payload,
  signature: signature
};
```

**Complete Directus Flow Setup (Using Script):**

1. Create a Flow with an "Item Created" trigger
2. Add a "Run Script" operation to generate the signature:
   ```javascript
   const crypto = require('crypto');
   const secret = 'your-webhook-secret';

   const payload = {
     eventId: Math.random().toString(36).substr(2, 9),
     eventType: 'item.create',
     timestamp: new Date().toISOString(),
     data: $trigger.body,
     metadata: {
       collection: 'items'
     }
   };

   const sig = crypto
     .createHmac('sha256', secret)
     .update(JSON.stringify(payload))
     .digest('hex');

   return { payload, sig };
   ```

3. Add a "Webhook" operation:
   - **URL:** `http://your-domain.com/api/webhook`
   - **Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     x-webhook-signature: {{ $last.sig }}
     ```
   - **Body:** `{{ $last.payload }}`

## Event Type Handlers

The webhook handler processes different event types:

### profile.export
Exports both profile schema and data to the `collected_data` collection. This combines the functionality of `export-profile-schema.ts` and `export-profile-data.ts` scripts.

**Request:**
```json
{
  "eventType": "profile.export",
  "data": {
    "profileId": 1
  }
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "processed": true,
    "profileId": 1,
    "schemaExport": {
      "success": true,
      "message": "Profile schema exported for profile ID 1"
    },
    "dataExport": {
      "success": true,
      "message": "Profile data exported for profile ID 1"
    }
  }
}
```

**What it does:**
1. Exports the profile schema (field names and notes) from Directus collections
2. Fetches all profile data including related records (work experiences, education, skills, etc.)
3. Stores both in the `collected_data` collection for the profile
4. Updates existing entries or creates new ones

**Default Handler Location:** `src/routes/api/webhook/+server.ts` → `handleProfileExport()`

**Utility Functions:** `src/lib/server/profile-export.ts`
- `exportProfile(profileId)` - Exports both schema and data
- `exportProfileSchema(profileId)` - Exports schema only
- `exportProfileData(profileId)` - Exports data only

### item.create
Called when a new item is created in Directus.

```json
{
  "eventType": "item.create",
  "data": {
    "id": "new-item-id",
    "field": "value"
  }
}
```

**Default Handler Location:** `src/routes/api/webhook/+server.ts` → `handleItemCreate()`

### item.update
Called when an existing item is updated.

```json
{
  "eventType": "item.update",
  "data": {
    "id": "existing-item-id",
    "field": "new-value"
  }
}
```

**Default Handler Location:** `src/routes/api/webhook/+server.ts` → `handleItemUpdate()`

### item.delete
Called when an item is deleted.

```json
{
  "eventType": "item.delete",
  "data": {
    "id": "deleted-item-id"
  }
}
```

**Default Handler Location:** `src/routes/api/webhook/+server.ts` → `handleItemDelete()`

### custom.event
For custom events defined in your Flow.

```json
{
  "eventType": "custom.event",
  "data": {
    "customField": "customValue"
  },
  "metadata": {
    "actionType": "some-action"
  }
}
```

**Default Handler Location:** `src/routes/api/webhook/+server.ts` → `handleCustomEvent()`

## Implementing Custom Logic

To handle specific webhook events, modify the handler functions in `src/routes/api/webhook/+server.ts`:

```typescript
async function handleItemCreate(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Add your business logic here
  console.log('Processing creation:', data);

  // Example: Send notification
  // await sendEmailNotification(data);

  // Example: Update related records
  // await db.updateRelatedRecords(data.id);

  return {
    processed: true,
    eventId,
    action: 'item.create',
    itemId: data.id
  };
}
```

## Testing the Webhook

### Using curl

```bash
# Generate signature
SECRET="your-webhook-secret"
PAYLOAD='{"eventId":"test-1","eventType":"item.create","timestamp":"2024-11-07T10:00:00Z","data":{"id":"123","name":"Test"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:5173/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Using Node.js

```javascript
const crypto = require('crypto');
const https = require('https');

const secret = 'your-webhook-secret';
const payload = {
  eventId: 'test-1',
  eventType: 'item.create',
  timestamp: new Date().toISOString(),
  data: { id: '123', name: 'Test' }
};

const payloadString = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', secret)
  .update(payloadString)
  .digest('hex');

const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/api/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-signature': signature,
    'Content-Length': payloadString.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => console.log(JSON.parse(data)));
});

req.write(payloadString);
req.end();
```

## Security Considerations

1. **Always use HTTPS in production** - Never send webhooks over plain HTTP
2. **Rotate webhook secrets periodically** - Change `WEBHOOK_SECRET` regularly
3. **Validate event structure** - The endpoint validates required fields
4. **Log webhook events** - Monitor webhook activity for debugging
5. **Implement rate limiting** - Add rate limiting to prevent abuse
6. **Verify timestamps** - Consider adding timestamp validation to prevent replay attacks

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBHOOK_SECRET` | HMAC secret for signature verification | 64-char hex string |
| `WEBHOOK_TIMEOUT` | Request timeout (optional, default 30s) | 30000 |

## Troubleshooting

### "Missing webhook signature header"
- Ensure you're sending the `x-webhook-signature` header
- Check the header name exactly matches (case-sensitive)

### "Invalid webhook signature"
- Verify the `WEBHOOK_SECRET` matches between Directus and `.env`
- Ensure you're signing the raw JSON body, not formatted/prettified JSON
- Check the signature algorithm (must be HMAC-SHA256)

### "Invalid JSON payload"
- Validate the JSON payload is properly formatted
- Check for encoding issues (must be UTF-8)

### Webhook not being called from Directus Flow
- Verify the Flow is enabled
- Check the Flow logs in Directus Admin
- Ensure the trigger condition is met
- Test manually with curl first

## Advanced: Webhook Utility Functions

The `src/lib/server/webhook.ts` module provides helper functions:

```typescript
import {
  generateWebhookSignature,
  generateWebhookSignatureFromString,
  verifyWebhookSignature,
  verifyWebhookSignatureFromString
} from '$lib/server/webhook';

// Generate signature for testing
const signature = generateWebhookSignature(payload, secret);

// Verify signature in custom routes
const isValid = verifyWebhookSignature(payload, signature, secret);
```

## References

- [Directus Flows Documentation](https://docs.directus.io/guides/headless-cms/flows)
- [HMAC-SHA256 Specification](https://en.wikipedia.org/wiki/HMAC)
- [SvelteKit Request Handlers](https://kit.svelte.dev/docs/routing#server)
