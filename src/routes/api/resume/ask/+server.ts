import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import OpenAI from "openai";
import { resume } from "$lib/data/resume.js";
import { isAdmin } from "$lib/auth.js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check if user is authenticated and has admin permissions
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const { question, context } = await request.json();

    if (!question) {
      return json({ error: "Question is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Convert resume data to a readable format for the AI
    const resumeContext = JSON.stringify(resume, null, 2);

    const systemPrompt =
      `You are an AI assistant helping Rik Wanders create professional content using his resume data. Your role is to generate cover letters, LinkedIn messages, emails, summaries, and other professional communications that showcase his experience and skills effectively.

Here is his complete resume data:

${resumeContext}

When generating content:
1. Use specific examples from his resume to support claims
2. Match the tone and style to the requested format (formal for cover letters, casual for LinkedIn, etc.)
3. Use the same writing style and voice as demonstrated in his resume - direct, results-focused, with specific metrics and achievements
4. Be authentic and highlight relevant experience
5. Keep content concise and impactful
6. If additional context is provided, incorporate it appropriately
7. Always be professional and accurate
8. Keep it formal, but don't sound too overly formal or LLM-like, and don't use rarely used words
9. Don't use em dashes to break up sentences
10. Mirror his resume's approach: lead with impact, include specific technologies, mention concrete results and percentages where relevant
11. Keep the content short and concise, except when explicitly asked for a longer / more detailed message
12. Write the content from the perspective of Rik Wanders, as if you are him`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: context
            ? `Request: ${question}\n\nAdditional Context: ${context}`
            : question,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content;

    if (!answer) {
      return json({ error: "No response generated" }, { status: 500 });
    }

    return json({
      question,
      answer,
    });
  } catch (error: any) {
    console.error("OpenAI API error:", error);

    if (error.code === "invalid_api_key") {
      return json({ error: "Invalid OpenAI API key" }, { status: 401 });
    }

    if (error.code === "rate_limit_exceeded") {
      return json({ error: "Rate limit exceeded. Please try again later." }, {
        status: 429,
      });
    }

    return json({ error: "Failed to generate response" }, { status: 500 });
  }
};

