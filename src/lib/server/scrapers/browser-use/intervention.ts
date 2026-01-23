/**
 * Manual intervention handling for CAPTCHA, 2FA, and login during Browser-Use flows
 */

import type { BrowserUseClient } from "$lib/server/browser/use-client";
import type { InterventionType, InterventionUrlType, Platform } from "../types";
import { promptUser } from "../utils";

/**
 * Get the intervention URL based on mode.
 * Returns VNC URL for local mode, Live URL for cloud mode.
 */
export function getInterventionInfo(
  browserUse: BrowserUseClient,
): { urlType: InterventionUrlType; url: string } {
  if (browserUse.isCloudMode && browserUse.liveUrl) {
    return { urlType: "live_url", url: browserUse.liveUrl };
  }
  return { urlType: "vnc", url: "localhost:5900" };
}

/**
 * Wait for user to complete manual intervention (CAPTCHA, 2FA, or login).
 * Supports both local mode (VNC) and cloud mode (Live URL).
 *
 * @param platform Platform information for display
 * @param interventionType Type of intervention needed
 * @param urlType VNC for local mode, live_url for cloud mode
 * @param interventionUrl The URL to display (VNC URL or Live URL)
 * @returns true if user confirms completion, false if cancelled
 */
export async function waitForManualIntervention(
  platform: Platform,
  interventionType: InterventionType,
  urlType: InterventionUrlType,
  interventionUrl: string,
): Promise<boolean> {
  const typeLabels: Record<InterventionType, string> = {
    captcha: "CAPTCHA",
    verification: "2FA Verification",
    login: "Manual Login",
  };

  const urlTypeLabels: Record<InterventionUrlType, string> = {
    vnc: "VNC",
    live_url: "Browser-Use Cloud Live URL",
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `🔐 ${typeLabels[interventionType]} Required for ${platform.name}`,
  );
  console.log(`${"=".repeat(60)}`);
  console.log(
    `\nPlease complete the ${
      typeLabels[interventionType].toLowerCase()
    } manually:`,
  );
  console.log(`  - ${urlTypeLabels[urlType]}: ${interventionUrl}`);

  if (urlType === "vnc") {
    console.log(`  - Connect with a VNC viewer to complete the task`);
  } else {
    console.log(`  - Open the URL in your browser to see the session`);
  }

  let confirm = "";
  while (confirm !== "c" && confirm !== "q") {
    confirm = (
      await promptUser(
        "\nWhen done, enter 'c' to continue or 'q' to quit: ",
      )
    ).toLowerCase();
  }

  if (confirm === "q") {
    console.log("❌ Manual intervention cancelled by user");
    return false;
  }

  console.log("✅ Continuing after manual intervention...");
  return true;
}
