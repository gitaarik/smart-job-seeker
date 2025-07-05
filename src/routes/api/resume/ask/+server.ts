import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { resume } from "$lib/data/resume.js";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";
import { getEnv } from "$lib/tools/get-env";

const openai = new OpenAI({
  apiKey: getEnv('OPENAI_API_KEY'),
});

const genAI = new GoogleGenerativeAI(getEnv('GEMINI_API_KEY') || "");

export const POST: RequestHandler = async ({ request, locals }) => {
  let llm = "openai"; // Default value
  
  try {
    // Check if user is authenticated and has admin permissions
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const requestData = await request.json();
    const { question, context, originalContent, isRefinement, responseId, sessionId, isManualEdit, manualContent } = requestData;
    llm = requestData.llm || "openai"; // Set llm with fallback

    if (!question) {
      return json({ error: "Question is required" }, { status: 400 });
    }

    // Check API keys based on selected LLM
    if (llm === "openai" && !getEnv('OPENAI_API_KEY')) {
      return json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    if (llm === "gemini" && !getEnv('GEMINI_API_KEY')) {
      return json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    // Convert resume data to a readable format for the AI
    const resumeContext = JSON.stringify(resume, null, 2);

    let systemPrompt;
    let userPrompt;

    if (isRefinement && originalContent) {
      // Special handling for refinement requests
      systemPrompt = `You are an AI assistant helping Rik Wanders refine and improve professional content. Your role is to modify existing content based on specific user requests while maintaining the same professional tone and style.

Here is his complete resume data for reference:

${resumeContext}

When refining content:
1. Keep the same writing style and voice as demonstrated in his resume - direct, results-focused, with specific metrics and achievements
2. Maintain the same tone and format of the original content
3. Make only the changes requested by the user
4. Keep the content authentic to Rik's background and experience
5. Don't change the fundamental message unless specifically asked
6. Keep it professional and accurate
7. Don't use em dashes to break up sentences
8. Write from the perspective of Rik Wanders, as if you are him`;

      userPrompt = `Please modify the following content based on this request: "${question}"

${context ? `Additional context: ${context}\n\n` : ''}Original content to modify:
${originalContent}`;
    } else {
      // Original content generation
      systemPrompt = `You are an AI assistant helping Rik Wanders create professional content using his resume data. Your role is to generate cover letters, LinkedIn messages, emails, summaries, and other professional communications that showcase his experience and skills effectively.

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

      userPrompt = context
        ? `Request: ${question}\n\nAdditional Context: ${context}`
        : question;
    }

    let answer: string;

    // Handle manual edits - no AI call needed
    if (isManualEdit && manualContent) {
      answer = manualContent;
    } else {
      // Regular AI generation
      if (llm === "gemini") {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fullPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        answer = response.text();
        
        if (!answer) {
          return json({ error: "No response generated from Gemini" }, { status: 500 });
        }
      } else {
        // OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        });

        answer = completion.choices[0]?.message?.content;

        if (!answer) {
          return json({ error: "No response generated from OpenAI" }, { status: 500 });
        }
      }
    }

    // Determine the LLM model based on provider
    const llmModel = llm === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";

    // Save to database
    if (isRefinement && responseId) {
      // Save refinement
      const refinement = await prisma.aiRefinement.create({
        data: {
          responseId,
          request: question,
          refinedContent: answer,
        },
      });

      // Update the current content of the response
      await prisma.aiResponse.update({
        where: { id: responseId },
        data: { 
          currentContent: answer,
          updatedAt: new Date()
        },
      });

      return json({
        question,
        answer,
        refinementId: refinement.id,
        responseId,
      });
    } else {
      // Save new response
      const aiResponse = await prisma.aiResponse.create({
        data: {
          userId: locals.user.id,
          prompt: question,
          context: context || null,
          originalContent: answer,
          currentContent: answer,
          llmProvider: llm,
          llmModel,
          sessionId: sessionId || null,
        },
      });

      return json({
        question,
        answer,
        responseId: aiResponse.id,
      });
    }
  } catch (error: any) {
    console.error(`${llm.toUpperCase()} API error:`, error);

    if (llm === "openai") {
      if (error.code === "invalid_api_key") {
        return json({ error: "Invalid OpenAI API key" }, { status: 401 });
      }
      
      if (error.code === "rate_limit_exceeded") {
        return json({ error: "OpenAI rate limit exceeded. Please try again later." }, {
          status: 429,
        });
      }
    } else if (llm === "gemini") {
      if (error.message?.includes("API_KEY_INVALID")) {
        return json({ error: "Invalid Gemini API key" }, { status: 401 });
      }

      if (error.message?.includes("QUOTA_EXCEEDED")) {
        return json({ error: "Gemini quota exceeded. Please try again later." }, {
          status: 429,
        });
      }
    }

    return json({ error: `Failed to generate response using ${llm.toUpperCase()}` }, { status: 500 });
  }
};

