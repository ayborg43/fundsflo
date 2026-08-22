import { test, expect } from "@playwright/test";
import {
  signUp,
  createAccount,
  createCategory,
  sendMessage,
  resetStub,
  stubStats,
} from "./helpers";

test.describe("the rest of the chat surface", () => {
  test("answers a question by streaming, without touching the ledger", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "how am I doing this month?");

    await expect(page.getByTestId("action-card")).toBeHidden();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Stub answer");

    const accounts = await (await page.request.get("/api/accounts")).json();
    expect(accounts.accounts.find((a: { id: string }) => a.id === accountId).balance).toBe(0);
  });

  test("creates a category from the chat after confirmation", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "add a category for pets");

    await expect(page.getByTestId("action-card")).toBeVisible();
    await expect(page.getByTestId("field-name")).toHaveValue(/pets/i);

    // Not created until confirmed.
    let listed = await (await page.request.get("/api/categories")).json();
    expect(listed.categories).toHaveLength(0);

    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("category");

    listed = await (await page.request.get("/api/categories")).json();
    expect(listed.categories).toHaveLength(1);
    expect(listed.categories[0].name).toMatch(/pets/i);
  });

  test("rejects a duplicate category on the card instead of creating one", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await createCategory(page.request, "Pets", "🐾");
    await page.goto("/");

    await sendMessage(page, "add a category for pets");
    await page.getByTestId("action-save-btn").click();

    await expect(page.getByTestId("action-card")).toContainText("already have");
    const listed = await (await page.request.get("/api/categories")).json();
    expect(listed.categories).toHaveLength(1);
  });

  test("asking to review spending or forecast is answered as a normal turn", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "review my spending please");
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Stub answer");

    await sendMessage(page, "where are my balances headed?");
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Stub answer");

    // Both persisted as ordinary exchanges, so a reload replays them.
    await page.reload();
    await expect(page.getByTestId("chat-msg-assistant")).toHaveCount(2);
    await expect(page.getByTestId("chat-msg-user").first()).toContainText("review my spending");
  });

  test("the prompt tells the model to caveat a projection", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await resetStub(page.request);
    await page.goto("/");

    await sendMessage(page, "where are my balances headed?");

    // The caveat used to live only in the forecast route's prompt; chat answers
    // these now, so it has to be in the shared system prompt.
    const stats = await stubStats(page.request);
    expect(stats.lastSystemPrompt).toContain("rough, directional estimate");
  });

  test("uploads a statement and shows the analysis", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await page.getByTestId("chat-upload-input").setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Description,Amount\n2026-08-01,COFFEE,-4.50\n"),
    });

    await expect(page.getByTestId("chat-msg-user").last()).toContainText("statement.csv");
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Stub insight");

    // Analysis-only: a statement must never create transactions.
    const accounts = await (await page.request.get("/api/accounts")).json();
    expect(accounts.accounts[0].balance).toBe(0);
  });
});

test.describe("guard rails", () => {
  test("a loan reads as paying down, not as spending", async ({ page }) => {
    await signUp(page);
    const loanId = await createAccount(page.request, "Bike Loan", "debt");
    expect(
      (await page.request.patch("/api/settings", { data: { defaultAccountId: loanId } })).ok()
    ).toBeTruthy();
    await page.goto("/");

    await sendMessage(page, "spent 20 on bike loan");

    // Against a debt account "spend" is a new charge and "make" pays it down;
    // Made/Spent would read backwards.
    await expect(page.getByTestId("action-card")).toContainText("New charge");
    await expect(page.getByTestId("field-type-spend")).toContainText("Charged");
    await expect(page.getByTestId("field-type-make")).toContainText("Paid off");

    await page.getByTestId("action-save-btn").click();
    // And the balance reads as an amount owed, not a negative number.
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("You owe");
  });

  test("statement uploads are throttled per user", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");

    const file = {
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Description,Amount\n2026-08-01,COFFEE,-4.50\n"),
    };

    // The test stack allows two per window; the third must be refused rather
    // than sent upstream.
    for (let i = 0; i < 2; i += 1) {
      const res = await page.request.post("/api/statements", {
        multipart: { file, fromChat: "1" },
      });
      expect(res.ok()).toBeTruthy();
    }

    const blocked = await page.request.post("/api/statements", {
      multipart: { file, fromChat: "1" },
    });
    expect(blocked.status()).toBe(429);
    expect(blocked.headers()["retry-after"]).toBeTruthy();
    expect((await blocked.json()).error).toContain("slow down");
  });
});

test.describe("what the model is actually sent", () => {
  test("the prompt carries budgets and bills", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    const categoryId = await createCategory(page.request, "Food");
    expect(
      (await page.request.post("/api/budgets", { data: { categoryId, monthlyLimit: 100 } })).ok()
    ).toBeTruthy();
    expect(
      (
        await page.request.post("/api/bills", {
          data: {
            name: "Netflix",
            amount: 15.99,
            dueDayOfMonth: 5,
            accountId,
            categoryId: null,
          },
        })
      ).ok()
    ).toBeTruthy();

    await resetStub(page.request);
    await page.goto("/");
    await sendMessage(page, "am I over my food budget?");

    const stats = await stubStats(page.request);
    expect(stats.lastSystemPrompt).toContain("Budgets (spend so far in the current period)");
    expect(stats.lastSystemPrompt).toContain("Food");
    expect(stats.lastSystemPrompt).toContain("Bills and payments due");
    expect(stats.lastSystemPrompt).toContain("Netflix");
  });

  test("chat history sent to the model is capped, not resent in full", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await resetStub(page.request);
    await page.goto("/");

    // Each question stores two rows (question + answer), so this pushes history
    // past the 30-message prompt cap.
    for (let i = 0; i < 18; i += 1) {
      await sendMessage(page, `question number ${i}?`);
    }

    const stored = await (await page.request.get("/api/ai/chat")).json();
    expect(stored.messages.length).toBeGreaterThan(30);

    // The UI keeps everything; the prompt must not. +1 for the system message.
    const stats = await stubStats(page.request);
    expect(stats.maxAnswerMessageCount).toBeLessThanOrEqual(31);
  });
});

test.describe("immediate feedback while waiting", () => {
  test("the message echoes and a typing indicator shows before the answer arrives", async ({
    page,
  }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await page.getByTestId("chat-input").fill("how am I doing?");
    const responsePromise = page.waitForResponse((r) => r.url().includes("/api/ai/chat"));
    await page.getByTestId("chat-send-btn").click();

    // Before the round trip resolves, the words are already on screen and
    // something visibly indicates work is happening -- not a blank pane.
    await expect(page.getByTestId("chat-msg-echo")).toHaveText("how am I doing?");
    await expect(page.getByTestId("chat-busy")).toBeVisible();

    await responsePromise;
    await expect(page.getByTestId("chat-msg-echo")).toBeHidden();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Stub answer");
  });

  test("the echo hands off to the confirmation card without duplicating the message", async ({
    page,
  }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await page.getByTestId("chat-input").fill("spent 12 on lunch");
    await page.getByTestId("chat-send-btn").click();

    await expect(page.getByTestId("action-card")).toBeVisible();
    // Exactly one bubble carries the message -- from the card, not a leftover echo.
    await expect(page.getByText("spent 12 on lunch")).toHaveCount(1);
  });
});
