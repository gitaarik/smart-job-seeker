import { config } from "./config";
import { dbDirect } from "$lib/db";

export interface BrowserUseConfig {
  baseUrl: string;
  timeout: number;
  enabled: boolean;
}

export interface ExecuteTaskParams {
  task: string; // Natural language task description
  startUrl: string; // URL to start from
  maxTime?: number; // Optional max execution time in seconds
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

export class BrowserUseClient {
  private config: BrowserUseConfig;

  constructor(customConfig?: Partial<BrowserUseConfig>) {
    // Use default config if not provided
    this.config = {
      baseUrl: customConfig?.baseUrl ?? config.browserUseUrl,
      timeout: customConfig?.timeout ?? config.browserUseTimeout,
      enabled: customConfig?.enabled ?? config.browserUseEnabled,
    };
  }

  async executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResponse> {
    const response = await fetch(`${this.config.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: params.task,
        start_url: params.startUrl,
        max_time: params.maxTime,
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
    });

    // Parse the JSON result
    try {
      // The result might be a string containing JSON or already parsed
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
      console.log("Raw response:", response.result);
      throw new Error("Browser-Use returned invalid JSON");
    }
  }
}
