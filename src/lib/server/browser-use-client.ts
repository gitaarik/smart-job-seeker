import { config } from "./config";

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
}
