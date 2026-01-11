import { config } from "./config";
import { dbDirect } from "$lib/db";

export interface BrowserUseConfig {
  baseUrl: string;
  timeout: number;
  sendScreenshots: boolean;
}

export interface ExecuteTaskParams {
  task: string; // Natural language task description
  startUrl: string; // URL to start from
  maxTime?: number; // Optional max execution time in seconds
  sendScreenshots?: boolean; // Optional screenshot configuration
}

export interface ExecuteTaskResponse {
  result: any; // Whatever the agent returns
  execution_time_ms: number;
}

// Job data structure expected from Browser-Use extraction
export interface JobData {
  title: string;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: string | Date | null; // Can be string from Browser-Use, Date after parsing
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[] | null;
  status: string | null;
  application_url?: string; // Optional, used as source URL
}

/**
 * Sanitize response object by removing screenshot data for logging
 */
function sanitizeForLogging(obj: any, maxDepth = 3, currentDepth = 0): any {
  if (currentDepth > maxDepth) return "[Max depth reached]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      sanitizeForLogging(item, maxDepth, currentDepth + 1)
    );
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip screenshot fields
    if (key === "screenshot" || key === "screenshots") {
      sanitized[key] = "[Screenshot data removed]";
      continue;
    }

    // Truncate very long strings (likely base64 encoded data)
    if (typeof value === "string" && value.length > 1000) {
      sanitized[key] = `[Long string truncated: ${value.length} chars]`;
      continue;
    }

    sanitized[key] = sanitizeForLogging(value, maxDepth, currentDepth + 1);
  }
  return sanitized;
}

export class BrowserUseClient {
  private config: BrowserUseConfig;

  constructor(customConfig?: Partial<BrowserUseConfig>) {
    // Use default config if not provided
    this.config = {
      baseUrl: customConfig?.baseUrl ?? config.browserUseUrl,
      timeout: customConfig?.timeout ?? config.browserUseTimeout,
      sendScreenshots: customConfig?.sendScreenshots ??
        config.browserUseSendScreenshots,
    };
    console.log(
      `[BrowserUseClient] Initialized with sendScreenshots: ${this.config.sendScreenshots} (custom: ${customConfig?.sendScreenshots}, env: ${config.browserUseSendScreenshots})`,
    );
  }

  async executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResponse> {
    const sendScreenshots = params.sendScreenshots ??
      this.config.sendScreenshots;
    console.log(
      `[BrowserUseClient] Sending request with send_screenshots: ${sendScreenshots}`,
    );

    const response = await fetch(`${this.config.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: params.task,
        start_url: params.startUrl,
        max_time: params.maxTime,
        send_screenshots: sendScreenshots,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Browser-Use API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Extract job data from a single job detail page using Browser-Use
   * @param jobUrl URL of the job posting to extract
   * @returns Structured job data
   */
  async extractSingleJob(jobUrl: string): Promise<JobData> {
    // Fetch prompt template from Directus
    const template = await dbDirect.ai_chat_prompts.findUnique({
      where: { request: "extract_job_data_browser_use" },
    });

    if (!template) {
      throw new Error(
        "Prompt template 'extract_job_data_browser_use' not found in ai_chat_prompts",
      );
    }

    // Combine system and user prompts for the Browser-Use task
    const task = `${template.system_prompt || ""}\n\n${
      template.user_prompt || ""
    }`.trim();

    // Execute the task
    const response = await this.executeTask({
      task,
      startUrl: jobUrl,
      maxTime: 60, // 1 minute max for single job
      sendScreenshots: this.config.sendScreenshots,
    });

    // Parse the JSON result
    try {
      // Check if Browser-Use returned an error/history object instead of job data
      if (typeof response.result === "object" && response.result !== null) {
        const resultObj = response.result as any;

        // If it has 'history' property, it means Browser-Use failed
        if (resultObj.history || resultObj.error) {
          // Check for rate limit errors
          const isRateLimit =
            JSON.stringify(resultObj).includes("Rate limit") ||
            JSON.stringify(resultObj).includes("rate limit") ||
            JSON.stringify(resultObj).includes("429");

          if (isRateLimit) {
            console.error("❌ Browser-Use hit LLM API rate limit");
            console.log(
              "💡 Tip: Check your LLM provider API key and rate limits",
            );
            console.log(
              "Current provider:",
              process.env.SJS_LLM_PROVIDER_BROWSER_USE ||
                process.env.SJS_LLM_PROVIDER || "groq",
            );
            throw new Error(
              "Browser-Use hit rate limit - check API key and provider limits",
            );
          }

          console.error("❌ Browser-Use failed to extract job data");
          console.log(
            "Error details:",
            JSON.stringify(sanitizeForLogging(resultObj), null, 2),
          );
          throw new Error("Browser-Use agent failed to extract job data");
        }

        // If it's already a valid job data object, return it
        if (resultObj.title || resultObj.job_description) {
          return resultObj as JobData;
        }
      }

      // Otherwise, try to parse as JSON string
      const resultStr = typeof response.result === "string"
        ? response.result
        : JSON.stringify(response.result);

      // Try to extract JSON from the result
      const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jobData = JSON.parse(jsonMatch[0]) as JobData;
        return jobData;
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (error) {
      console.error("❌ Failed to parse Browser-Use response:", error);
      console.log(
        "Raw response:",
        JSON.stringify(sanitizeForLogging(response.result), null, 2),
      );
      throw new Error("Browser-Use returned invalid or failed response");
    }
  }
}
