import type { AccountType, TransactionType } from "./types";
import { formatMoney } from "./format";

// A debt account stores its balance negative, so the ledger signs invert in
// meaning: "make" pays the debt down, "spend" adds a charge. Saying "Made" and
// "Spent" against a loan reads backwards -- paying off a bike loan is not
// making money. The wording lives here so the confirmation card and the
// server's confirmation message can never drift apart.

export type DirectionCopy = {
  /** Heading on the confirmation card's accent band. */
  band: string;
  /** Label on the make/spend toggle. */
  toggle: string;
  /** Verb opening the saved confirmation message. */
  verb: string;
  /** How the account is introduced: "in Spending", "off Bike Loan". */
  preposition: string;
  /** Label above the account picker. */
  accountLabel: string;
  emoji: string;
};

export function directionCopy(
  accountType: AccountType | null,
  type: TransactionType
): DirectionCopy {
  if (accountType === "debt") {
    return type === "make"
      ? {
          band: "Paying it down",
          toggle: "Paid off",
          verb: "Paid",
          preposition: "off",
          accountLabel: "Toward",
          emoji: "🎉",
        }
      : {
          band: "New charge",
          toggle: "Charged",
          verb: "Charged",
          preposition: "to",
          accountLabel: "On",
          emoji: "💳",
        };
  }

  return type === "make"
    ? {
        band: "Money in",
        toggle: "Made",
        verb: "Added",
        preposition: "in",
        accountLabel: "Into",
        emoji: "🤑",
      }
    : {
        band: "Money out",
        toggle: "Spent",
        verb: "Logged",
        preposition: "in",
        accountLabel: "From",
        emoji: "💸",
      };
}

// A debt balance of -228 means "owes 228"; reporting it as "-$228" reads as a
// deficit in an asset account rather than an amount outstanding.
export function balanceSentence(
  accountName: string,
  accountType: AccountType,
  balance: number,
  currency: string
): string {
  if (accountType === "debt") {
    const owed = Math.max(0, -balance);
    return owed === 0
      ? `${accountName} is all paid off!`
      : `You owe ${formatMoney(owed, currency)} on ${accountName}.`;
  }
  return `${accountName} is now ${formatMoney(balance, currency)}.`;
}
