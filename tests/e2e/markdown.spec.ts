import { test, expect } from "@playwright/test";
import { signUp, createAccount, sendMessage } from "./helpers";

// Models write markdown whether or not they are asked to. Rendered as plain
// text the asterisks showed up literally -- "**Food budget:** **$3,012**" --
// so this pins down that replies are formatted and the user's own words are not.
test.describe("assistant formatting", () => {
  test("a reply renders as bold text and real bullets, with no asterisks left", async ({
    page,
  }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    await sendMessage(page, "formatting probe please");

    const bubble = page.getByTestId("chat-msg-assistant").last();
    await expect(bubble).toBeVisible();

    // The markup is real, not literal characters.
    await expect(bubble.locator("strong").first()).toHaveText("Food budget expenses:");
    // Two labels, two amounts in the list, one in the closing line.
    await expect(bubble.locator("strong")).toHaveCount(5);
    await expect(bubble.locator("li")).toHaveCount(2);

    const text = (await bubble.textContent()) ?? "";
    expect(text).not.toContain("**");
    expect(text).toContain("$3,012");
    // The bullet character is drawn by the list, not carried in the text.
    expect(text.startsWith("*")).toBe(false);
  });

  test("the user's own message is shown exactly as typed", async ({ page }) => {
    await signUp(page);
    await createAccount(page.request, "Checking");
    await page.goto("/");

    // Asterisks a person typed are theirs, not formatting to reinterpret.
    await sendMessage(page, "what about **this**?");
    await expect(page.getByTestId("chat-msg-user").last()).toContainText("**this**");
  });
});
