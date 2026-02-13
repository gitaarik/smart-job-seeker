#!/usr/bin/env node

import { hashPassword } from "better-auth/crypto";
import { createInterface } from "readline";
import { dbDirect as db } from "$lib/server/db";

const MIN_PASSWORD_LENGTH = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let id: string | undefined;
  let password: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[++i];
    } else if (args[i] === "--id" && args[i + 1]) {
      id = args[++i];
    } else if (args[i] === "--password" && args[i + 1]) {
      password = args[++i];
    }
  }

  if (!email && !id) {
    console.error(
      "Usage: set-user-password --email <email> | --id <id> [--password <password>]",
    );
    process.exit(1);
  }

  return { email, id, password };
}

async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Disable echoing
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdout.write("New password: ");

    let password = "";
    process.stdin.on("data", (data) => {
      const char = data.toString();

      if (char === "\n" || char === "\r" || char === "\u0004") {
        process.stdout.write("\n");
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        rl.close();
        resolve(password);
      } else if (char === "\u007F" || char === "\b") {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(1);
      } else {
        password += char;
      }
    });
  });
}

async function main() {
  const { email, id, password: passwordArg } = parseArgs();

  const user = await db.user.findFirst({
    where: email ? { email } : { id },
  });

  if (!user) {
    console.error(`User not found: ${email ?? id}`);
    process.exit(1);
  }

  console.log(`User: ${user.name} (${user.email})`);

  const password = passwordArg ?? await promptPassword();

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
    process.exit(1);
  }

  const hash = await hashPassword(password);

  const existing = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existing) {
    await db.account.update({
      where: { id: existing.id },
      data: { password: hash },
    });
  } else {
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  console.log("Password updated successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
