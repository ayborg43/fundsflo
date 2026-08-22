import { test, expect } from "@playwright/test";
import { signUp, createAccount, createCategory, balanceOf, sendMessage } from "./helpers";

// The classify -> confirm -> commit path is the app's primary surface now, so
// these cover it end to end: what the card shows, that nothing is written
// before confirmation, and that the ledger actually moves afterwards.
test.describe("logging money from the chat", () => {
  test("shows a draft card and writes nothing until it is confirmed", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "spent 12 on lunch");

    const card = page.getByTestId("action-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("field-amount")).toHaveValue("12");
    await expect(page.getByTestId("field-description")).toHaveValue("lunch");
    // Single account, so it should already be selected rather than asking.
    await expect(page.getByTestId("field-accountId")).toHaveValue(accountId);

    // Nothing committed yet.
    expect(await balanceOf(page.request, accountId)).toBe(0);

    await page.getByTestId("action-save-btn").click();

    await expect(card).toBeHidden();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Logged $12");
    expect(await balanceOf(page.request, accountId)).toBe(-12);
  });

  test("cancelling leaves no transaction and no chat history", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "spent 30 on games");
    await expect(page.getByTestId("action-card")).toBeVisible();
    await page.getByTestId("action-cancel-btn").click();

    await expect(page.getByTestId("action-card")).toBeHidden();
    // The wording is handed back for editing rather than lost.
    await expect(page.getByTestId("chat-input")).toHaveValue("spent 30 on games");
    expect(await balanceOf(page.request, accountId)).toBe(0);

    const history = await (await page.request.get("/api/ai/chat")).json();
    expect(history.messages).toHaveLength(0);
  });

  test("edits on the card are what get written", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    const categoryId = await createCategory(page.request, "Food");
    await page.goto("/");

    await sendMessage(page, "spent 12 on lunch");
    await page.getByTestId("field-amount").fill("15.50");
    await page.getByTestId("field-description").fill("big lunch");
    await page.getByTestId("field-categoryId").selectOption(categoryId);
    await page.getByTestId("action-save-btn").click();

    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("$15.5");
    expect(await balanceOf(page.request, accountId)).toBe(-15.5);
  });

  test("asks which account when the message names none and there is no default", async ({
    page,
  }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await createAccount(page.request, "Savings", "savings");
    await page.goto("/");

    await sendMessage(page, "spent 20 on books");

    // Ambiguous, so the card must not pick for the user.
    await expect(page.getByTestId("field-accountId")).toHaveValue("");
    await expect(page.getByTestId("action-save-btn")).toBeDisabled();
  });

  test("uses the default account set in settings", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    const savingsId = await createAccount(page.request, "Savings", "savings");
    const patch = await page.request.patch("/api/settings", {
      data: { defaultAccountId: savingsId },
    });
    expect(patch.ok()).toBeTruthy();
    await page.goto("/");

    await sendMessage(page, "spent 20 on books");
    await expect(page.getByTestId("field-accountId")).toHaveValue(savingsId);
  });

  test("backdates an entry and can undo it", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "yesterday I spent 15 on snacks");

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    // The date is chips now, with the native picker only behind "Another day".
    await expect(page.getByTestId("field-date-yesterday")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText(yesterday);
    expect(await balanceOf(page.request, accountId)).toBe(-15);

    await page.getByTestId("undo-log-btn").click();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Undone");
    expect(await balanceOf(page.request, accountId)).toBe(0);
  });
});
