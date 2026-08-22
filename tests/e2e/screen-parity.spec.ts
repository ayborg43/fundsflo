import { test, expect } from "@playwright/test";
import { signUp, createAccount, createCategory } from "./helpers";

// The chat can create things (weekly/daily budgets, one-off payments, bill
// reminders) that the dedicated screens previously had no way to show or
// create. These pin down that the screens now represent the same data.
test.describe("Budgets screen shows and sets a period", () => {
  test("a weekly budget set from the chat is labelled correctly on the screen", async ({
    page,
  }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    const categoryId = await createCategory(page.request, "Food");
    const res = await page.request.post("/api/budgets", {
      data: { categoryId, limitAmount: 50, period: "week" },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto("/budgets");
    // Both the jar's own testid prefix and "Food" as text are ambiguous: the
    // category <select> is also "budget-*" and its <option>s repeat every
    // category name. The period tag's own prefix, and a locator scoped to a
    // visible (non-<option>) element, are the two things that are unique.
    await expect(page.getByText("🍔 Food", { exact: true }).locator("visible=true")).toBeVisible();
    await expect(page.locator('[data-testid^="budget-period-"]')).toHaveText("per week");
  });

  test("the add-budget form can set a day, week or month limit", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await createCategory(page.request, "Food");
    await page.goto("/budgets");

    await page.getByTestId("budget-category-select").selectOption({ index: 1 });
    await page.getByTestId("period-option-day").click();
    await page.getByTestId("budget-limit-input").fill("15");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/budgets") && r.request().method() === "POST"),
      page.getByTestId("add-budget-btn").click(),
    ]);

    await expect(page.getByText("per day")).toBeVisible();
    const { budgets } = await (await page.request.get("/api/budgets")).json();
    expect(budgets[0].period).toBe("day");
    expect(budgets[0].limitAmount).toBe(15);
  });
});

test.describe("Bills screen handles one-offs and reminders", () => {
  test("a one-off bill from the chat shows as one-off, not a monthly cycle", async ({ page }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    const dueDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await page.request.post("/api/bills", {
      data: {
        name: "School trip",
        amount: 40,
        recurrence: "once",
        dueDate,
        accountId,
        categoryId: null,
      },
    });

    await page.goto("/bills");
    const card = page.getByTestId(/^bill-[0-9a-f-]+$/);
    await expect(card).toBeVisible();
    await expect(card.getByTestId(/^bill-once-/)).toBeVisible();
    await expect(card).toContainText("Due in 5d");
  });

  test("the add-bill form can create a one-off with a date and a reminder", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/bills");

    await page.getByTestId("bill-recurrence-once").click();
    await page.getByTestId("bill-name-input").fill("School trip");
    await page.getByTestId("bill-amount-input").fill("40");
    const dueDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await page.getByTestId("bill-due-date-input").fill(dueDate);
    await page.getByTestId("bill-remind-input").fill("2");
    // The click handler's fetch is async and nothing visible marks it done,
    // so wait for the POST itself rather than racing it with the API read.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/bills") && r.request().method() === "POST"),
      page.getByTestId("add-bill-btn").click(),
    ]);

    const { bills } = await (await page.request.get("/api/bills")).json();
    expect(bills).toHaveLength(1);
    expect(bills[0].recurrence).toBe("once");
    expect(bills[0].dueDayOfMonth).toBeNull();
    expect(bills[0].remindDaysBefore).toBe(2);

    await expect(page.getByTestId(/^bill-reminder-/)).toBeVisible();
  });

  test("marking a one-off bill paid keeps it paid, not tied to the calendar month", async ({
    page,
  }) => {
    await signUp(page);
    const accountId = await createAccount(page.request, "Checking");
    const created = await (
      await page.request.post("/api/bills", {
        data: {
          name: "School trip",
          amount: 40,
          recurrence: "once",
          dueDate: new Date().toISOString().slice(0, 10),
          accountId,
          categoryId: null,
        },
      })
    ).json();

    await page.goto("/bills");
    await page.getByTestId(`pay-bill-${created.bill.id}`).click();
    await expect(page.getByTestId(`bill-${created.bill.id}`)).toContainText("Paid ✓");
    await expect(page.getByTestId(`bill-${created.bill.id}`)).not.toContainText(
      "Paid this month"
    );
  });
});
