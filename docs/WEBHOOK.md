# Webhook Integration Guide

This document explains how to set up and use the secure webhook endpoint for
Directus Flow integration.

## Overview

The webhook endpoint (`POST /api/webhook`) allows Directus Flow scripts to
securely send data to your SvelteKit application. The integration uses a shared
secret key for authentication.

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

Add the generated secret to your `.env` file (or `.env.me` for local
development):

```
SJS_WEBHOOK_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f"
```

For production, add to `.env.production`:

```
SJS_WEBHOOK_SECRET="your-production-webhook-secret-key"
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

The `x-webhook-secret` header must match the `SJS_WEBHOOK_SECRET` environment
variable.

### Body

```json
{
  "eventType": "profile.export|ai_chat.generate_full_prompt|ai_chat.generate_response|ai_chat.create_followup|application_letter.generate|application_letter.create_followup|application_interview_question.generate_ai_answer|application_questions.create_followup|profile_version.generate_preview_links|item.create|item.update|item.delete|custom.event",
  "data": {
    "id": "some-id",
    "field1": "value1",
    "field2": "value2"
  }
}
```

### Payload Fields

- **eventType** (required): Type of event (`profile.export`, `item.create`,
  `item.update`, `item.delete`, or custom)
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

Exports both profile schema and data to the `collected_data` collection for one
or more profiles. This combines the functionality of `export-profile-schema.ts`
and `export-profile-data.ts` scripts.

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
   - Exports the profile schema (field names and notes) from Directus
     collections
   - Fetches all profile data including related records (work experiences,
     education, skills, etc.)
   - Stores both in the `collected_data` collection for the profile
   - Updates existing entries or creates new ones
4. Returns detailed results for each profile, including individual
   success/failure status

**Default Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleProfileExport()`

**Utility Functions:** `src/lib/server/profile-export.ts`

- `exportProfile(profileId)` - Exports both schema and data
- `exportProfileSchema(profileId)` - Exports schema only
- `exportProfileData(profileId)` - Exports data only

### ai_chat.generate_full_prompt

Generates the `full_prompt` field for AI chat instances by combining
`system_prompt` and `user_prompt` with variable interpolation. Supports template
variables like `${schema}`, `${data}`, and `${jobDescription}`.

**Request:**

```json
{
  "eventType": "ai_chat.generate_full_prompt",
  "data": {
    "aiChatIds": [123, 456, 789]
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
    "aiChatCount": 3,
    "successCount": 3,
    "results": [
      {
        "aiChatId": 123,
        "success": true,
        "message": "Full prompt generated successfully"
      },
      {
        "aiChatId": 456,
        "success": true,
        "message": "Full prompt generated successfully"
      },
      {
        "aiChatId": 789,
        "success": true,
        "message": "Full prompt generated successfully"
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more AI chat IDs
2. For each AI chat instance:
   - Fetches the `system_prompt` and `user_prompt` fields
   - Fetches related profile data and job description if referenced
   - Interpolates template variables (`${schema}`, `${data}`,
     `${jobDescription}`)
   - Combines prompts into a single `full_prompt` field
   - Updates the AI chat record with the generated prompt
3. Returns detailed results for each AI chat instance
4. Used as the first step in AI content generation workflow

**Use Case:** Automatically prepare AI prompts when users create new AI chat
instances from templates. The generated `full_prompt` is then used by the
`ai_chat.generate_response` event.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleAiChatGenerateFullPrompt()`

**Utility Functions:** `src/lib/server/ai-chat-full-prompt-generate.ts`

### ai_chat.generate_response

Generates AI responses using the Groq API based on the `full_prompt` field.
Requires `SJS_GROQ_API_KEY` environment variable to be set.

**Request:**

```json
{
  "eventType": "ai_chat.generate_response",
  "data": {
    "aiChatIds": [123, 456]
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
    "aiChatCount": 2,
    "successCount": 2,
    "results": [
      {
        "aiChatId": 123,
        "success": true,
        "message": "AI response generated successfully"
      },
      {
        "aiChatId": 456,
        "success": true,
        "message": "AI response generated successfully"
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more AI chat IDs
2. For each AI chat instance:
   - Fetches the `full_prompt` field (must be populated first)
   - Sends the prompt to Groq API for AI response generation
   - Stores the generated response in the `ai_response` field
   - Updates metadata (model used, tokens, etc.)
3. Returns detailed results for each AI chat instance
4. Processes requests in parallel for efficiency

**Use Case:** Generate AI content (cover letters, interview answers, etc.) after
the full prompt has been prepared. This is the second step in the AI generation
workflow.

**Prerequisites:**

- AI chat must have `full_prompt` populated (use `ai_chat.generate_full_prompt`
  first)
- `SJS_GROQ_API_KEY` environment variable must be configured

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleAiChatGenerateResponse()`

**Utility Functions:** `src/lib/server/ai-chat-response-generate.ts`

### ai_chat.create_followup

Creates follow-up AI chat instances for iterative refinement of AI-generated
content. Allows users to request modifications (tone, length, emphasis) to
existing AI responses.

**Request:**

```json
{
  "eventType": "ai_chat.create_followup",
  "data": {
    "keys": [123, 456],
    "followup_request": "Make it more formal and concise",
    "include_original_context": "true"
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
    "parentAiChatCount": 2,
    "successCount": 2,
    "results": [
      {
        "parentAiChatId": 123,
        "success": true,
        "message": "Follow-up AI chat created successfully",
        "newAiChatId": 789
      },
      {
        "parentAiChatId": 456,
        "success": true,
        "message": "Follow-up AI chat created successfully",
        "newAiChatId": 790
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more parent AI chat IDs and a follow-up request
2. For each parent AI chat:
   - Creates a new AI chat instance linked to the parent
   - Includes the parent's response in the context
   - Optionally includes the original context (profile data, job description)
   - Sets up the new prompt combining original context + previous response +
     follow-up request
   - Links the new AI chat to the same application/letter/question as the parent
3. Returns the new AI chat IDs for further processing

**Use Case:** Enable iterative refinement of AI-generated content. Users can
request changes like "make it shorter", "use more technical language", "add more
enthusiasm" without starting from scratch.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleAiChatCreateFollowup()`

**Utility Functions:** `src/lib/server/ai-chat-create-followup.ts`

### application_letter.generate

Generates application letters (cover letters, motivation letters, follow-up
emails, thank-you letters) using AI based on profile data and job description.

**Request:**

```json
{
  "eventType": "application_letter.generate",
  "data": {
    "letterIds": [45, 46, 47],
    "additionalContext": "Emphasize my leadership experience"
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
    "letterCount": 3,
    "successCount": 3,
    "results": [
      {
        "letterId": 45,
        "success": true,
        "message": "Application letter generated successfully"
      },
      {
        "letterId": 46,
        "success": true,
        "message": "Application letter generated successfully"
      },
      {
        "letterId": 47,
        "success": true,
        "message": "Application letter generated successfully"
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more letter IDs and optional additional context
2. For each letter:
   - Fetches the letter record including type (cover_letter, motivation_letter,
     follow_up_email, thank_you_letter)
   - Fetches related application and job description
   - Fetches profile data for the application
   - Creates an AI chat instance with appropriate template
   - Generates full prompt with all context
   - Calls Groq API to generate the letter content
   - Updates the letter with generated content
   - Links the AI chat to the letter for follow-up capability
3. Supports batch processing for efficiency

**Letter Types:**

- `cover_letter` - Formal introduction to accompany application
- `motivation_letter` - Detailed explanation of interest and qualifications
- `follow_up_email` - Check-in after application submission
- `thank_you_letter` - Post-interview appreciation

**Use Case:** Automatically generate personalized letters for job applications
based on the candidate's profile and specific job requirements.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleApplicationLetterGenerate()`

**Utility Functions:** `src/lib/server/ai-chat-application-letter.ts`

### application_letter.create_followup

Creates a follow-up AI chat to refine an existing application letter. Allows
users to request modifications without regenerating from scratch.

**Request:**

```json
{
  "eventType": "application_letter.create_followup",
  "data": {
    "letterId": 45,
    "followup_request": "Make it more enthusiastic and reduce to 3 paragraphs",
    "include_original_context": true
  }
}
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "success": true,
    "message": "Follow-up AI chat created successfully",
    "data": {
      "aiChatId": 789,
      "letterId": 45
    }
  }
}
```

**What it does:**

1. Accepts a letter ID and follow-up request
2. Fetches the letter and its linked AI chat
3. Creates a new AI chat instance as a follow-up to the original
4. Includes:
   - The previously generated letter content
   - Optionally, the original context (profile, job description)
   - The new follow-up request
5. Links the new AI chat to the letter
6. Returns the new AI chat ID for processing

**Use Case:** Enable iterative improvement of application letters. Common
requests include adjusting tone, length, emphasis on specific experiences, or
formatting changes.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleApplicationLetterCreateFollowup()`

**Utility Functions:** `src/lib/server/ai-chat-application-letter-followup.ts`

### application_interview_question.generate_ai_answer

Generates AI-assisted answers to application interview questions based on the
candidate's profile and the specific question.

**Request:**

```json
{
  "eventType": "application_interview_question.generate_ai_answer",
  "data": {
    "ids": [12, 13, 14]
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
    "questionCount": 3,
    "successCount": 3,
    "results": [
      {
        "questionId": 12,
        "success": true,
        "message": "AI answer generated successfully"
      },
      {
        "questionId": 13,
        "success": true,
        "message": "AI answer generated successfully"
      },
      {
        "questionId": 14,
        "success": true,
        "message": "AI answer generated successfully"
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more question IDs
2. For each question:
   - Fetches the question and related application
   - Fetches the candidate's profile data
   - Creates an AI chat instance with the question-answering template
   - Generates a prompt including profile context and the question
   - Calls Groq API to generate a personalized answer
   - Updates the question with the AI-generated answer
   - Links the AI chat for follow-up refinement
3. Processes multiple questions in parallel

**Use Case:** Help candidates prepare for interviews by generating personalized
answers based on their actual experience and skills. Answers can be refined
using the follow-up system.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleApplicationInterviewQuestionGenerateAiAnswer()`

**Utility Functions:** `src/lib/server/ai-chat-application-question.ts`

### application_questions.create_followup

Creates a follow-up AI chat to refine an AI-generated answer to an application
question.

**Request:**

```json
{
  "eventType": "application_questions.create_followup",
  "data": {
    "questionId": 12,
    "followup_request": "Add a specific example from my work at TechCorp",
    "include_original_context": true
  }
}
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "success": true,
    "message": "Follow-up AI chat created successfully",
    "data": {
      "aiChatId": 795,
      "questionId": 12
    }
  }
}
```

**What it does:**

1. Accepts a question ID and follow-up request
2. Fetches the question and its linked AI chat with the previous answer
3. Creates a new AI chat instance as a follow-up
4. Includes:
   - The previously generated answer
   - Optionally, the original context (profile data, question text)
   - The new follow-up request
5. Links the new AI chat to the question
6. Returns the new AI chat ID for processing

**Use Case:** Refine AI-generated interview answers by adding specific examples,
adjusting length, changing tone, or emphasizing particular aspects of
experience.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleApplicationQuestionsCreateFollowup()`

**Utility Functions:** `src/lib/server/ai-chat-application-question-followup.ts`

### profile_version.generate_preview_links

Generates HTML preview links for profile versions, providing quick access to
resume and CV in both HTML and PDF formats.

**Request:**

```json
{
  "eventType": "profile_version.generate_preview_links",
  "data": {
    "profileVersionIds": [5, 6, 7]
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
    "profileVersionCount": 3,
    "successCount": 3,
    "results": [
      {
        "profileVersionId": 5,
        "success": true,
        "message": "Preview links generated successfully"
      },
      {
        "profileVersionId": 6,
        "success": true,
        "message": "Preview links generated successfully"
      },
      {
        "profileVersionId": 7,
        "success": true,
        "message": "Preview links generated successfully"
      }
    ]
  }
}
```

**What it does:**

1. Accepts one or more profile version IDs
2. For each profile version:
   - Fetches the version name
   - Generates HTML with links to resume and CV pages
   - Creates links for both HTML view and PDF download
   - URL-encodes the version name for proper routing
   - Updates the `preview_links` field with the generated HTML
3. Returns success status for each profile version

**Generated Links:**

- Resume HTML: `http://localhost:5173/resume?version={versionName}`
- Resume PDF: `http://localhost:5173/resume.pdf?version={versionName}`
- CV HTML: `http://localhost:5173/cv?version={versionName}`
- CV PDF: `http://localhost:5173/cv.pdf?version={versionName}`

**Use Case:** Automatically generate convenient preview links when profile
versions are created, making it easy to view and share different versions of
resumes and CVs.

**Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleProfileVersionGeneratePreviewLinks()`

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

**Default Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleItemCreate()`

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

**Default Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleItemUpdate()`

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

**Default Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleItemDelete()`

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

**Default Handler Location:** `src/routes/api/webhook/+server.ts` →
`handleCustomEvent()`

## Implementing Custom Logic

To handle specific webhook events, modify the handler functions in
`src/routes/api/webhook/+server.ts`:

```typescript
async function handleItemCreate(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Add your business logic here
  console.log("Processing creation:", data);

  // Example: Send notification
  // await sendEmailNotification(data);

  // Example: Update related records
  // await db.updateRelatedRecords(data.id);

  return {
    processed: true,
    eventId,
    action: "item.create",
    itemId: data.id,
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
const https = require("https");

const secret = "your-webhook-secret";
const payload = {
  eventType: "item.create",
  data: { id: "123", name: "Test" },
};

const payloadString = JSON.stringify(payload);

const options = {
  hostname: "localhost",
  port: 5173,
  path: "/api/webhook",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-secret": secret,
    "Content-Length": payloadString.length,
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => console.log(JSON.parse(data)));
});

req.write(payloadString);
req.end();
```

## Security Considerations

1. **Always use HTTPS in production** - Never send webhooks over plain HTTP
2. **Rotate webhook secrets periodically** - Change `SJS_WEBHOOK_SECRET` regularly
3. **Keep secret private** - Do not commit the secret to version control
4. **Validate event structure** - The endpoint validates required fields
5. **Log webhook events** - Monitor webhook activity for debugging
6. **Implement rate limiting** - Add rate limiting to prevent abuse

## Environment Variables

| Variable             | Description                      | Example            |
| -------------------- | -------------------------------- | ------------------ |
| `SJS_WEBHOOK_SECRET` | Shared secret for authentication | 64-char hex string |

## Troubleshooting

### "Missing webhook secret header"

- Ensure you're sending the `x-webhook-secret` header
- Check the header name exactly matches (case-sensitive)

### "Invalid webhook secret"

- Verify the secret matches the `SJS_WEBHOOK_SECRET` environment variable
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
