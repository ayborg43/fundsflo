import { test, expect } from "@playwright/test";
import { signUp, createAccount, createCategory, sendMessage } from "./helpers";

// The chat is a command surface now: nine actions, all of which propose first
// and write only on confirmation.
test.describe("acting on the app from the chat", () => {
  test("changes the currency, and says what that does not do", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "switch my currency to naira");

    const card = page.getByTestId("action-card");
    await expect(card).toHaveAttribute("data-action", "set_currency");
    // Relabelling is not converting, and the card has to say so.
    await expect(card).toContainText("not the amounts already recorded");

    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("NGN");

    const settings = await (await page.request.get("/api/settings")).status();
    expect([200, 405]).toContain(settings); // route is PATCH-only; just proving auth
    await page.goto("/accounts");
    await expect(page.getByTestId("net-worth-line")).toContainText("₦");
  });

  test("creates an account", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "add a new account");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "create_account");
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    const { accounts } = await (await page.request.get("/api/accounts")).json();
    expect(accounts.map((a: { name: string }) => a.name)).toContain("Holiday");
  });

  test("deletes a category, leaving its transactions alone", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    const categoryId = await createCategory(page.request, "Food");
    await page.request.post(`/api/accounts/${accountId}/transactions`, {
      data: { type: "spend", amount: 9, description: "lunch", categoryId, tag: null },
    });
    await page.goto("/");

    await sendMessage(page, "delete the food category");
    const card = page.getByTestId("action-card");
    await expect(card).toHaveAttribute("data-action", "delete_category");
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    const { categories } = await (await page.request.get("/api/categories")).json();
    expect(categories).toHaveLength(0);
    // The spend survives; only the tag goes.
    const { accounts } = await (await page.request.get("/api/accounts")).json();
    expect(accounts.find((a: { id: string }) => a.id === accountId).balance).toBe(-9);
  });

  test("adds a recurring bill, then marks it paid", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "add my netflix bill");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "create_bill");
    await page.getByTestId("field-accountId").selectOption(accountId);
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("chat-msg-assistant").last()).toContainText("Netflix");

    await sendMessage(page, "mark netflix paid");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "mark_bill_paid");
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    // Marking paid also records the spend against the account.
    const { accounts } = await (await page.request.get("/api/accounts")).json();
    expect(accounts.find((a: { id: string }) => a.id === accountId).balance).toBeCloseTo(-15.99, 2);
    const { bills } = await (await page.request.get("/api/bills")).json();
    expect(bills[0].lastPaidAt).not.toBeNull();
  });

  test("records a one-off thing to pay for", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "I need to pay for the school trip on friday");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "create_bill");
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    const { bills } = await (await page.request.get("/api/bills")).json();
    expect(bills).toHaveLength(1);
    expect(bills[0].recurrence).toBe("once");
    expect(bills[0].dueDate).not.toBeNull();
    // A one-off has a date, not a day-of-month.
    expect(bills[0].dueDayOfMonth).toBeNull();
  });

  test("sets a reminder on a bill", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    await page.request.post("/api/bills", {
      data: { name: "Netflix", amount: 15.99, dueDayOfMonth: 5, accountId, categoryId: null },
    });
    await page.goto("/");

    await sendMessage(page, "remind me about netflix");
    await expect(page.getByTestId("action-card")).toHaveAttribute(
      "data-action",
      "set_bill_reminder"
    );
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    const { bills } = await (await page.request.get("/api/bills")).json();
    expect(bills[0].remindDaysBefore).toBe(3);
  });

  test("sets a weekly budget, not just a monthly one", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await createCategory(page.request, "Food");
    await page.goto("/");

    await sendMessage(page, "set a weekly budget for food");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "set_budget");
    await page.getByTestId("action-save-btn").click();
    await expect(page.getByTestId("action-card")).toBeHidden();

    const { budgets } = await (await page.request.get("/api/budgets")).json();
    expect(budgets).toHaveLength(1);
    expect(budgets[0].period).toBe("week");
    expect(budgets[0].limitAmount).toBe(50);
  });

  test("one message can ask for two things", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    // The old single-intent classifier could not express this at all.
    await sendMessage(page, "switch me to naira and add my netflix bill");

    await expect(page.getByTestId("queue-progress")).toContainText("1 of 2");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "set_currency");
    await page.getByTestId("action-save-btn").click();

    await expect(page.getByTestId("queue-progress")).toContainText("2 of 2");
    await expect(page.getByTestId("action-card")).toHaveAttribute("data-action", "create_bill");
    await page.getByTestId("action-save-btn").click();

    await expect(page.getByTestId("action-card")).toBeHidden();
    const { bills } = await (await page.request.get("/api/bills")).json();
    expect(bills).toHaveLength(1);
    // The message is filed once, not once per action.
    const { messages } = await (await page.request.get("/api/ai/chat")).json();
    expect(messages.filter((m: { role: string }) => m.role === "user")).toHaveLength(1);
  });
});
