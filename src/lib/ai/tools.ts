// The chat's command surface, declared once.
//
// This replaces the hand-rolled single-intent JSON classifier. That was the
// right shape for one action; at nine it is not. Two things forced the change:
// a single classifier can only return ONE intent per message, and a nine-way
// branch in one prompt gets brittle. Tool calling gives typed arguments,
// schema validation at the model boundary, and several actions from one
// sentence -- "switch me to naira and add my netflix bill" comes back as two
// calls.
//
// Every tool here MUTATES something. Reads are deliberately absent: the whole
// financial picture is already in the system prompt, so "what's my balance?"
// is answered directly and needs no round trip. That keeps this a single model
// call -- propose, confirm, execute -- with no tool-result turn.
//
// Nothing here executes. Tools produce proposals that the user confirms on a
// card; `src/app/api/ai/act/route.ts` performs the write and re-validates
// every argument. A misheard "delete my food category" costs a tap, not data.

import { CURRENCIES } from "../currency";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const ACTION_NAMES = [
  "log_transaction",
  "create_category",
  "delete_category",
  "create_account",
  "set_currency",
  "create_bill",
  "mark_bill_paid",
  "set_bill_reminder",
  "set_budget",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export function isActionName(value: string): value is ActionName {
  return (ACTION_NAMES as readonly string[]).includes(value);
}

function obj(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

export function buildTools(): ToolDefinition[] {
  const currencyCodes = CURRENCIES.map((c) => c.code);

  const fn = (name: ActionName, description: string, parameters: Record<string, unknown>) => ({
    type: "function" as const,
    function: { name, description, parameters },
  });

  return [
    fn(
      "log_transaction",
      "Record money the user has already made or spent. Only for money that has actually moved.",
      obj(
        {
          type: {
            type: "string",
            enum: ["make", "spend"],
            description:
              "make = money in; spend = money out. Against an account of type 'debt' this flips: paying the debt down is 'make', a new charge is 'spend'.",
          },
          amount: { type: "number", description: "Positive amount, digits only." },
          description: { type: "string", description: "1-4 words for what it was for." },
          account: {
            type: "integer",
            description: "Number of the account from the ACCOUNTS list, or omit if not named.",
          },
          category: {
            type: "integer",
            description: "Number from the CATEGORIES list, or omit if none fits.",
          },
          date: {
            type: "string",
            description:
              "Calendar day it happened as YYYY-MM-DD, only if the user said when. Never in the future.",
          },
        },
        ["type", "amount"]
      )
    ),
    fn(
      "create_category",
      "Create a new spending category. Only when the user explicitly asks for one.",
      obj(
        {
          name: { type: "string", description: "1-3 words." },
          emoji: { type: "string", description: "One emoji suiting the category." },
        },
        ["name"]
      )
    ),
    fn(
      "delete_category",
      "Delete an existing spending category. Only when the user explicitly asks.",
      obj(
        { category: { type: "integer", description: "Number from the CATEGORIES list." } },
        ["category"]
      )
    ),
    fn(
      "create_account",
      "Add a new account to track money in.",
      obj(
        {
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["cash", "checking", "savings", "credit", "debt", "investment"],
          },
          starting_balance: {
            type: "number",
            description: "Only for a debt account: how much is owed to begin with.",
          },
        },
        ["name", "type"]
      )
    ),
    fn(
      "set_currency",
      "Change the currency the app displays money in. This changes the symbol only; it does not convert existing amounts.",
      obj({ code: { type: "string", enum: currencyCodes } }, ["code"])
    ),
    fn(
      "create_bill",
      "Add something the user has to pay: a monthly recurring bill, or a one-off payment due on a date.",
      obj(
        {
          name: { type: "string" },
          amount: { type: "number" },
          recurrence: {
            type: "string",
            enum: ["monthly", "once"],
            description: "'once' for a single thing they need to pay for; 'monthly' for a bill.",
          },
          due_day: {
            type: "integer",
            description: "Monthly only: day of the month, 1-31.",
          },
          due_date: {
            type: "string",
            description: "One-off only: the date it is due, YYYY-MM-DD.",
          },
          remind_days_before: {
            type: "integer",
            description: "Only if the user asked to be reminded: how many days ahead.",
          },
          account: { type: "integer", description: "Number from the ACCOUNTS list, if named." },
          category: { type: "integer", description: "Number from the CATEGORIES list, if it fits." },
        },
        ["name", "amount", "recurrence"]
      )
    ),
    fn(
      "mark_bill_paid",
      "Mark an existing bill as paid, which also records the spend against its account.",
      obj({ bill: { type: "string", description: "The bill's name as the user said it." } }, [
        "bill",
      ])
    ),
    fn(
      "set_bill_reminder",
      "Turn a reminder on or off for an existing bill.",
      obj(
        {
          bill: { type: "string", description: "The bill's name." },
          days_before: {
            type: "integer",
            description: "Days ahead to be reminded. Use 0 to turn the reminder off.",
          },
        },
        ["bill", "days_before"]
      )
    ),
    fn(
      "set_budget",
      "Set a spending limit for a category, per day, week or month.",
      obj(
        {
          category: { type: "integer", description: "Number from the CATEGORIES list." },
          amount: { type: "number", description: "The limit." },
          period: { type: "string", enum: ["day", "week", "month"] },
        },
        ["category", "amount", "period"]
      )
    ),
  ];
}
