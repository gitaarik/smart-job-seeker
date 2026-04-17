#!/usr/bin/env node

import { hashPassword } from "better-auth/crypto";
import { createInterface } from "node:readline";
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

function readHidden(prompt: string): Promise<string> {
  if (process.stdin.isTTY) {
    process.stderr.write(prompt);
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");

      let value = "";
      const onData = (ch: string) => {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          process.stdin.removeListener("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          resolve(value);
        } else if (ch === "\u0003") {
          process.stdin.setRawMode(false);
          process.stderr.write("\n");
          process.exit(1);
        } else if (ch === "\u007F" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      };
      process.stdin.on("data", onData);
    });
  }

  // Fallback for piped/non-TTY input
  const rl = createInterface({ input: process.stdin });
  return new Promise((resolve) => {
    rl.once("line", (line) => {
      rl.close();
      resolve(line);
    });
  });
}

async function promptPassword(): Promise<string> {
  const password = await readHidden("New password: ");
  if (process.stdin.isTTY) {
    const confirm = await readHidden("Confirm password: ");
    if (password !== confirm) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
  }
  return password;
}

async function updateAppUser(
  email: string | undefined,
  id: string | undefined,
  password: string,
): Promise<boolean> {
  const user = await db.user.findFirst({
    where: email ? { email } : { id },
  });

  if (!user) return false;

  console.log(`App user: ${user.name} (${user.email})`);

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

  console.log("  ✓ App password updated");
  return true;
}

async function main() {
  const { email, id, password: passwordArg } = parseArgs();

  const password = passwordArg ?? await promptPassword();

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
    process.exit(1);
  }

  const appUpdated = await updateAppUser(email, id, password);

  if (!appUpdated) {
    console.error(`User not found: ${email ?? id}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
