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

// CDP task parameters for hybrid scraper (login via CDP connection)
export interface CdpTaskParams {
  task: string; // Natural language task description (login + navigate)
  cdpUrl: string; // CDP endpoint URL (e.g., "http://localhost:9222")
  maxTime?: number; // Optional max execution time in seconds
  sendScreenshots?: boolean; // Optional screenshot configuration
}

// CDP task response with handoff information
export interface CdpTaskResponse {
  result: any; // Whatever the agent returns
  execution_time_ms: number;
  login_success: boolean; // Whether login was successful
  current_url: string; // URL browser ended up on
  ready_for_handoff: boolean; // Whether ready for Patchright to take over
}

// Hybrid session parameters (Browser-Use launches Chrome, keeps it open)
export interface HybridSessionParams {
  task: string; // Natural language login task
  startUrl: string; // URL to start from (login page)
  cdpPort?: number; // Port for CDP (default 9222)
  maxTime?: number; // Max execution time in seconds
  sendScreenshots?: boolean;
}

// Hybrid session response
export interface HybridSessionResponse {
  login_success: boolean;
  verification_needed?: boolean; // True if 2FA/verification required
  verification_type?: string; // "email", "sms", "2fa", "code"
  verification_prompt?: string; // User-friendly prompt
  current_url: string;
  cdp_port: number;
  execution_time_ms: number;
  error?: string;
}

// Verification code response
export interface VerifyCodeResponse {
  success: boolean; // Whether the code was accepted
  login_complete: boolean; // Whether login is now complete
  needs_new_code: boolean; // Whether code expired and needs resend
  captcha_needed?: boolean; // CAPTCHA appeared, user must solve manually via VNC
  current_url: string;
  execution_time_ms: number;
  error?: string;
}

// Resend code response
export interface ResendCodeResponse {
  success: boolean;
  execution_time_ms: number;
  error?: string;
}

// Hybrid action parameters (for clicking jobs, closing modals, etc.)
export interface HybridActionParams {
  actionType: "click_job" | "close_modal" | "scroll";
  targetDescription: string; // e.g., "the job titled 'Senior Python Developer'"
  cdpPort?: number;
  maxTime?: number;
  sendScreenshots?: boolean;
}

// Hybrid action response
export interface HybridActionResponse {
  success: boolean;
  action_performed: string; // "completed", "not_found", "wrong_button", etc.
  current_url: string;
  execution_time_ms: number;
  error?: string;
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

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/execute`, {
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
    } catch (error) {
      // Network-level failure - the browser-use server likely crashed
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`\n❌ Failed to communicate with browser-use server`);
      console.error(`   Error: ${errorMsg}`);
      console.error(
        `\n💡 The browser-use server likely crashed. Common causes:`,
      );
      console.error(
        `   - LLM API rate limit exceeded (e.g., Groq daily token limit)`,
      );
      console.error(
        `   - LLM context length exceeded (task accumulated too much history)`,
      );
      console.error(`   - Network timeout or server overload`);
      console.error(`\n📋 Check browser-use container logs for details:`);
      console.error(`   docker compose logs browser-use --tail=50\n`);

      throw new Error(
        `Browser-Use server connection failed: ${errorMsg}. Check 'docker compose logs browser-use' for LLM API errors.`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Browser-Use API returned error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Browser-Use API error: ${response.status} ${response.statusText}`,
      );
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

  /**
   * Execute a login task by connecting to an existing Chrome instance via CDP.
   * Used by the hybrid scraper for AI-driven login before Patchright extraction.
   * @param params CDP task parameters including cdpUrl
   * @returns Response with login_success, current_url, and ready_for_handoff
   */
  async executeLoginWithCdp(params: CdpTaskParams): Promise<CdpTaskResponse> {
    const sendScreenshots = params.sendScreenshots ??
      this.config.sendScreenshots;
    console.log(
      `[BrowserUseClient] CDP login request with send_screenshots: ${sendScreenshots}`,
    );
    console.log(`[BrowserUseClient] CDP URL: ${params.cdpUrl}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/execute-with-cdp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: params.task,
          cdp_url: params.cdpUrl,
          max_time: params.maxTime,
          send_screenshots: sendScreenshots,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`\n❌ Failed to communicate with browser-use server (CDP)`);
      console.error(`   Error: ${errorMsg}`);
      console.error(`\n💡 Common causes:`);
      console.error(`   - Browser-use server not running`);
      console.error(`   - LLM API rate limit exceeded`);
      console.error(`   - Network timeout`);
      console.error(`\n📋 Check browser-use container logs:`);
      console.error(`   docker compose logs browser-use --tail=50\n`);

      throw new Error(
        `Browser-Use CDP connection failed: ${errorMsg}. Check 'docker compose logs browser-use' for details.`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Browser-Use CDP API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Browser-Use CDP API error: ${response.status} ${response.statusText}`,
      );
    }

    const result: CdpTaskResponse = await response.json();

    console.log(
      `[BrowserUseClient] CDP login result: success=${result.login_success}, url=${result.current_url}, ready=${result.ready_for_handoff}`,
    );

    return result;
  }

  /**
   * Start a hybrid session: Browser-Use launches Chrome with CDP, performs login,
   * and keeps the browser open for Patchright to connect.
   * @param params Hybrid session parameters
   * @returns Response with login_success, current_url, cdp_port
   */
  async startHybridSession(
    params: HybridSessionParams,
  ): Promise<HybridSessionResponse> {
    const sendScreenshots = params.sendScreenshots ??
      this.config.sendScreenshots;
    console.log(
      `[BrowserUseClient] Starting hybrid session, CDP port: ${
        params.cdpPort ?? 9222
      }`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: params.task,
          start_url: params.startUrl,
          cdp_port: params.cdpPort ?? 9222,
          max_time: params.maxTime,
          send_screenshots: sendScreenshots,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to start hybrid session: ${errorMsg}`);
      throw new Error(`Hybrid session failed: ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Hybrid session API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Hybrid session API error: ${response.status} ${response.statusText}`,
      );
    }

    const result: HybridSessionResponse = await response.json();

    console.log(
      `[BrowserUseClient] Hybrid session result: success=${result.login_success}, url=${result.current_url}, port=${result.cdp_port}`,
    );

    return result;
  }

  /**
   * Close the hybrid browser session.
   * Call this after Patchright has finished extracting jobs.
   */
  async closeHybridSession(): Promise<void> {
    console.log(`[BrowserUseClient] Closing hybrid session...`);

    try {
      const response = await fetch(`${this.config.baseUrl}/hybrid/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`[BrowserUseClient] Hybrid session closed`);
      } else {
        console.warn(
          `[BrowserUseClient] Failed to close hybrid session: ${response.status}`,
        );
      }
    } catch (error) {
      console.warn(
        `[BrowserUseClient] Error closing hybrid session: ${error}`,
      );
    }
  }

  /**
   * Submit a verification code to continue login.
   * Call this after startHybridSession returns verification_needed=true.
   * @param code The verification code to enter
   * @param cdpPort CDP port (default 9222)
   * @returns Response with success, login_complete, needs_new_code
   */
  async submitVerificationCode(
    code: string,
    cdpPort: number = 9222,
  ): Promise<VerifyCodeResponse> {
    console.log(`[BrowserUseClient] Submitting verification code...`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          cdp_port: cdpPort,
          max_time: 60,
          send_screenshots: this.config.sendScreenshots,
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to submit verification code: ${errorMsg}`);
      return {
        success: false,
        login_complete: false,
        needs_new_code: false,
        current_url: "",
        execution_time_ms: 0,
        error: `Verification submission failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Verification API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        login_complete: false,
        needs_new_code: false,
        current_url: "",
        execution_time_ms: 0,
        error:
          `Verification API error: ${response.status} ${response.statusText}`,
      };
    }

    const result: VerifyCodeResponse = await response.json();

    console.log(
      `[BrowserUseClient] Verification result: success=${result.success}, login_complete=${result.login_complete}, needs_new_code=${result.needs_new_code}`,
    );

    return result;
  }

  /**
   * Request a new verification code.
   * Call this when the verification code has expired.
   * @param cdpPort CDP port (default 9222)
   * @returns Response with success status
   */
  async resendVerificationCode(
    cdpPort: number = 9222,
  ): Promise<ResendCodeResponse> {
    console.log(`[BrowserUseClient] Requesting new verification code...`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdp_port: cdpPort,
          max_time: 30,
          send_screenshots: this.config.sendScreenshots,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to resend verification code: ${errorMsg}`);
      return {
        success: false,
        execution_time_ms: 0,
        error: `Resend code failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Resend code API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        execution_time_ms: 0,
        error:
          `Resend code API error: ${response.status} ${response.statusText}`,
      };
    }

    const result: ResendCodeResponse = await response.json();

    console.log(
      `[BrowserUseClient] Resend code result: success=${result.success}`,
    );

    return result;
  }

  /**
   * Perform a single action on the existing hybrid browser session.
   * Uses Browser-Use's visual AI to click job cards, close modals, etc.
   * @param params Action parameters
   * @returns Response with success status and action details
   */
  async performHybridAction(
    params: HybridActionParams,
  ): Promise<HybridActionResponse> {
    const sendScreenshots = params.sendScreenshots ??
      this.config.sendScreenshots;
    console.log(
      `[BrowserUseClient] Performing hybrid action: ${params.actionType}`,
    );
    console.log(`[BrowserUseClient] Target: ${params.targetDescription}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: params.actionType,
          target_description: params.targetDescription,
          cdp_port: params.cdpPort ?? 9222,
          max_time: params.maxTime ?? 30,
          send_screenshots: sendScreenshots,
        }),
        signal: AbortSignal.timeout(120000), // 120s timeout for action (screenshots add latency)
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n[BrowserUseClient] Hybrid action failed: ${errorMsg}`);
      return {
        success: false,
        action_performed: "error",
        current_url: "",
        execution_time_ms: 0,
        error: `Hybrid action failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n[BrowserUseClient] Hybrid action API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        action_performed: "error",
        current_url: "",
        execution_time_ms: 0,
        error:
          `Hybrid action API error: ${response.status} ${response.statusText}`,
      };
    }

    const result: HybridActionResponse = await response.json();

    console.log(
      `[BrowserUseClient] Hybrid action result: success=${result.success}, performed=${result.action_performed}`,
    );

    return result;
  }

  // =====================
  // Session Management Methods
  // =====================

  /**
   * Check if the persistent session is logged in for a platform.
   * @param checkUrl URL to navigate to (e.g., the job search page)
   * @param loginUrlPattern Pattern indicating login page (if URL contains this, not logged in)
   * @param cdpPort CDP port (default 9222)
   * @returns Session status with is_logged_in flag
   */
  async checkSession(
    checkUrl: string,
    loginUrlPattern: string,
    cdpPort: number = 9222,
  ): Promise<{
    session_exists: boolean;
    is_logged_in: boolean;
    current_url: string;
    cdp_port: number;
  }> {
    console.log(`[BrowserUseClient] Checking session for: ${checkUrl}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_url: checkUrl,
          login_url_pattern: loginUrlPattern,
          cdp_port: cdpPort,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to check session: ${errorMsg}`);
      return {
        session_exists: false,
        is_logged_in: false,
        current_url: "",
        cdp_port: cdpPort,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Session check API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        session_exists: false,
        is_logged_in: false,
        current_url: "",
        cdp_port: cdpPort,
      };
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Session check: exists=${result.session_exists}, logged_in=${result.is_logged_in}`,
    );
    return result;
  }

  /**
   * Start browser with existing persistent session (no login attempt).
   * Use this to launch the browser for manual login.
   * @param startUrl URL to navigate to
   * @param cdpPort CDP port (default 9222)
   * @returns Session start response with VNC URL for manual intervention
   */
  async startSession(
    startUrl: string,
    cdpPort: number = 9222,
  ): Promise<{
    success: boolean;
    current_url: string;
    cdp_port: number;
    vnc_url: string;
  }> {
    console.log(`[BrowserUseClient] Starting session at: ${startUrl}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_url: startUrl,
          cdp_port: cdpPort,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to start session: ${errorMsg}`);
      throw new Error(`Session start failed: ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Session start API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Session start API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Session started: ${result.current_url}, VNC: ${result.vnc_url}`,
    );
    return result;
  }

  /**
   * Wait for manual login completion by polling the current URL.
   * @param targetUrlPattern Pattern indicating successful login (e.g., "/jobs", "/feed")
   * @param cdpPort CDP port (default 9222)
   * @param timeoutSeconds Timeout in seconds (default 300 = 5 minutes)
   * @param pollIntervalSeconds Poll interval in seconds (default 5)
   * @returns Response with success flag and current URL
   */
  async waitForLogin(
    targetUrlPattern: string,
    cdpPort: number = 9222,
    timeoutSeconds: number = 300,
    pollIntervalSeconds: number = 5,
  ): Promise<{
    success: boolean;
    current_url: string;
    timed_out: boolean;
  }> {
    console.log(
      `[BrowserUseClient] Waiting for login (target pattern: ${targetUrlPattern})...`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/wait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url_pattern: targetUrlPattern,
          cdp_port: cdpPort,
          timeout: timeoutSeconds,
          poll_interval: pollIntervalSeconds,
        }),
        signal: AbortSignal.timeout((timeoutSeconds + 30) * 1000), // Extra 30s buffer
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Wait for login failed: ${errorMsg}`);
      return {
        success: false,
        current_url: "",
        timed_out: true,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Wait for login API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        current_url: "",
        timed_out: false,
      };
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Wait for login result: success=${result.success}, timed_out=${result.timed_out}`,
    );
    return result;
  }

  /**
   * Clear the persistent session data.
   * Use this to force a fresh login on next scrape.
   */
  async clearSession(): Promise<{
    success: boolean;
    message: string;
  }> {
    console.log(`[BrowserUseClient] Clearing session...`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to clear session: ${errorMsg}`);
      return {
        success: false,
        message: `Clear session failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Clear session API error: ${response.status} ${response.statusText}`,
      );
      return {
        success: false,
        message:
          `Clear session API error: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();
    console.log(`[BrowserUseClient] Clear session result: ${result.message}`);
    return result;
  }
}
