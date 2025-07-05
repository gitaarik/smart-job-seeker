# Webhook Integration Guide

This document explains how to set up and use the secure webhook endpoint for Directus Flow integration.

## Overview

The webhook endpoint (`POST /api/webhook`) allows Directus Flow scripts to securely send data to your SvelteKit application. The integration uses a shared secret key for authentication.

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
x-webhook-secret: your-webhook-secret-key
```

The `x-webhook-secret` header must match the `WEBHOOK_SECRET` environment variable.

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

### Step 1: Create a Flow

1. Go to Directus Admin Panel → Settings → Flows
2. Click "Create Flow"
3. Choose a trigger (e.g., "Item Created", "Item Updated")
4. Add a "Webhook" operation

### Step 2: Configure the Webhook Operation

In the Webhook operation:

1. **URL:** `http://localhost:5173/api/webhook` (or your production URL)
2. **Method:** `POST`
3. **Headers:**
   ```
   Content-Type: application/json
   x-webhook-secret: your-webhook-secret-key
   ```
4. **Body:** (Create the payload JSON)
   ```json
   {
     "eventType": "item.create",
     "data": {
       "id": "{{ $trigger.body.id }}",
       "name": "{{ $trigger.body.name }}"
     }
   }
   ```

### Step 3: Example Webhook Setup

**For a "profile.export" event with multiple profiles:**

1. Create a Flow with your desired trigger
2. Add a Webhook operation with:
   - **URL:** `http://your-domain.com/api/webhook`
   - **Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     x-webhook-secret: your-webhook-secret-key
     ```
   - **Body (for multiple profiles):**
     ```json
     {
       "eventType": "profile.export",
       "data": {
         "profileIds": [1, 2, 3]
       }
     }
     ```
   - **Body (for single profile):**
     ```json
     {
       "eventType": "profile.export",
       "data": {
         "profileId": "{{ $trigger.body.id }}"
       }
     }
     ```

## Event Type Handlers

The webhook handler processes different event types:

### profile.export
Exports both profile schema and data to the `collected_data` collection for one or more profiles. This combines the functionality of `export-profile-schema.ts` and `export-profile-data.ts` scripts.

**Request (Multiple Profiles):**
```json
{
  "eventType": "profile.export",
  "data": {
    "profileIds": [1, 2, 3]
  }
}
```

**Request (Single Profile - Backwards Compatible):**
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
    "profileCount": 3,
    "successCount": 3,
    "results": [
      {
        "profileId": 1,
        "success": true,
        "schemaExport": {
          "success": true,
          "message": "Profile schema exported for profile ID 1"
        },
        "dataExport": {
          "success": true,
          "message": "Profile data exported for profile ID 1"
        }
      },
      {
        "profileId": 2,
        "success": true,
        "schemaExport": {
          "success": true,
          "message": "Profile schema exported for profile ID 2"
        },
        "dataExport": {
          "success": true,
          "message": "Profile data exported for profile ID 2"
        }
      },
      {
        "profileId": 3,
        "success": true,
        "schemaExport": {
          "success": true,
          "message": "Profile schema exported for profile ID 3"
        },
        "dataExport": {
          "success": true,
          "message": "Profile data exported for profile ID 3"
        }
      }
    ]
  }
}
```

**What it does:**
1. Accepts one or more profile IDs
2. Processes each profile in parallel (non-blocking)
3. For each profile:
   - Exports the profile schema (field names and notes) from Directus collections
   - Fetches all profile data including related records (work experiences, education, skills, etc.)
   - Stores both in the `collected_data` collection for the profile
   - Updates existing entries or creates new ones
4. Returns detailed results for each profile, including individual success/failure status

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
SECRET="your-webhook-secret"
PAYLOAD='{"eventType":"item.create","data":{"id":"123","name":"Test"}}'

curl -X POST http://localhost:5173/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $SECRET" \
  -d "$PAYLOAD"
```

### Using Node.js

```javascript
const https = require('https');

const secret = 'your-webhook-secret';
const payload = {
  eventType: 'item.create',
  data: { id: '123', name: 'Test' }
};

const payloadString = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/api/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-secret': secret,
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
3. **Keep secret private** - Do not commit the secret to version control
4. **Validate event structure** - The endpoint validates required fields
5. **Log webhook events** - Monitor webhook activity for debugging
6. **Implement rate limiting** - Add rate limiting to prevent abuse

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBHOOK_SECRET` | Shared secret for authentication | 64-char hex string |

## Troubleshooting

### "Missing webhook secret header"
- Ensure you're sending the `x-webhook-secret` header
- Check the header name exactly matches (case-sensitive)

### "Invalid webhook secret"
- Verify the secret matches the `WEBHOOK_SECRET` environment variable
- Ensure there are no extra spaces or trailing characters in the secret

### "Invalid JSON payload"
- Validate the JSON payload is properly formatted
- Check for encoding issues (must be UTF-8)

### Webhook not being called from Directus Flow
- Verify the Flow is enabled
- Check the Flow logs in Directus Admin
- Ensure the trigger condition is met
- Test manually with curl first

## References

- [Directus Flows Documentation](https://docs.directus.io/guides/headless-cms/flows)
- [HMAC-SHA256 Specification](https://en.wikipedia.org/wiki/HMAC)
- [SvelteKit Request Handlers](https://kit.svelte.dev/docs/routing#server)
