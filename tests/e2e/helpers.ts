import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const AI_STUB_URL = process.env.E2E_AISTUB_URL ?? "http://aistub:8080";

let seq = 0;

// Each test gets its own user. The suite shares one database, so isolating by
// account rather than by truncating keeps tests independent without teardown.
export async function signUp(page: Page): Promise<{ email: string }> {
  seq += 1;
  const email = `e2e-${Date.now()}-${seq}@example.test`;
  const res = await page.request.post("/api/auth/register", {
    data: { email, password: "e2e-password-123" },
  });
  expect(res.ok(), `register failed: ${await res.text()}`).toBeTruthy();
  return { email };
}

export async function createAccount(
  request: APIRequestContext,
  name: string,
  type = "checking"
): Promise<string> {
  const res = await request.post("/api/accounts", {
    data: { name, type, startingBalance: null },
  });
  expect(res.ok(), `create account failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).account.id;
}

export async function createCategory(
  request: APIRequestContext,
  name: string,
  emoji = "🍔"
): Promise<string> {
  const res = await request.post("/api/categories", { data: { name, emoji } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).category.id;
}

export async function balanceOf(request: APIRequestContext, accountId: string): Promise<number> {
  const res = await request.get("/api/accounts");
  expect(res.ok()).toBeTruthy();
  const { accounts } = await res.json();
  const found = accounts.find((a: { id: string }) => a.id === accountId);
  expect(found, "account missing from /api/accounts").toBeTruthy();
  return found.balance;
}

export async function resetStub(request: APIRequestContext): Promise<void> {
  await request.post(`${AI_STUB_URL}/_reset`);
}

export async function stubStats(request: APIRequestContext): Promise<{
  lastSystemPrompt: string | null;
  lastAnswerMessageCount: number;
  maxAnswerMessageCount: number;
  answerCalls: number;
  classifierCalls: number;
}> {
  const res = await request.get(`${AI_STUB_URL}/_stats`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Send a chat message and wait for the request to settle, so assertions don't
// race the round-trip.
export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByTestId("chat-input").fill(text);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/ai/chat") && r.request().method() === "POST"),
    page.getByTestId("chat-send-btn").click(),
  ]);
}
