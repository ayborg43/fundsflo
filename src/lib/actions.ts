// How each confirmable action presents itself.
//
// One descriptor per action instead of one component per action: adding a
// tenth action should be a few lines of data, not another card component with
// its own copy of the layout, disabled logic and button row.

import type { AccountSummary, Category } from "./types";
import { CURRENCIES, CURRENCY_CHANGE_CAVEAT } from "./currency";
import { formatMoney } from "./format";
import { directionCopy } from "./wording";

export type FieldKind =
  | "segmented"
  | "money"
  | "number"
  | "text"
  | "emoji"
  | "select"
  | "dateChips"
  | "date";

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Half-width fields pair up on one row. */
  half?: boolean;
  /** Chips and selects can allow an empty choice. */
  emptyLabel?: string;
};

export type ActionContext = {
  accounts: AccountSummary[];
  categories: Category[];
  currency: string;
  today: string;
};

export type Values = Record<string, unknown>;

export type ActionDescriptor = {
  /** Left side of the accent band. */
  band: (v: Values, c: ActionContext) => string;
  /** Right side of the accent band, usually the amount. */
  headline?: (v: Values, c: ActionContext) => string;
  accent: (v: Values, c: ActionContext) => string;
  /** White text on the band for the darker accents. */
  invertBand?: (v: Values, c: ActionContext) => boolean;
  fields: (v: Values, c: ActionContext) => Field[];
  confirmLabel: string;
  destructive?: boolean;
  canSave: (v: Values) => boolean;
  hint?: (v: Values, c: ActionContext) => string | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOf = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

const accountOptions = (c: ActionContext) => c.accounts.map((a) => ({ value: a.id, label: a.name }));
const categoryOptions = (c: ActionContext) =>
  c.categories.map((x) => ({ value: x.id, label: `${x.emoji} ${x.name}` }));

export const ACTIONS: Record<string, ActionDescriptor> = {
  log_transaction: {
    band: (v, c) => {
      const type = c.accounts.find((a) => a.id === str(v.accountId))?.type ?? null;
      return directionCopy(type, v.type === "make" ? "make" : "spend").band;
    },
    headline: (v, c) => formatMoney(numOf(v.amount), c.currency),
    accent: (v) => (v.type === "make" ? "var(--gus-lime)" : "var(--gus-orange)"),
    invertBand: (v) => v.type !== "make",
    fields: (v, c) => {
      const type = c.accounts.find((a) => a.id === str(v.accountId))?.type ?? null;
      return [
        {
          key: "type",
          label: "",
          kind: "segmented",
          options: [
            { value: "spend", label: directionCopy(type, "spend").toggle },
            { value: "make", label: directionCopy(type, "make").toggle },
          ],
        },
        { key: "amount", label: "Amount", kind: "money", half: true },
        { key: "description", label: "What for", kind: "text", placeholder: "e.g. lunch", half: true },
        { key: "date", label: "When", kind: "dateChips" },
        {
          key: "accountId",
          label: directionCopy(type, v.type === "make" ? "make" : "spend").accountLabel,
          kind: "select",
          options: accountOptions(c),
          emptyLabel: "Choose…",
          half: c.categories.length > 0,
        },
        ...(c.categories.length > 0
          ? [
              {
                key: "categoryId",
                label: "Category",
                kind: "select" as const,
                options: categoryOptions(c),
                emptyLabel: "None",
                half: true,
              },
            ]
          : []),
      ];
    },
    confirmLabel: "Save it",
    canSave: (v) => !!str(v.accountId) && numOf(v.amount) > 0,
    hint: (v) => (str(v.accountId) ? null : "Pick an account and I'll save it."),
  },

  create_category: {
    band: () => "New category",
    accent: () => "var(--gus-yellow)",
    fields: () => [
      { key: "emoji", label: "Emoji", kind: "emoji", half: true },
      { key: "name", label: "Name", kind: "text", placeholder: "e.g. Pets", half: true },
    ],
    confirmLabel: "Add it",
    canSave: (v) => str(v.name).trim().length > 0,
  },

  delete_category: {
    band: () => "Delete category",
    headline: (v) => `${str(v.emoji)} ${str(v.name)}`,
    accent: () => "var(--gus-orange)",
    invertBand: () => true,
    fields: () => [],
    confirmLabel: "Delete it",
    destructive: true,
    canSave: () => true,
    hint: () => "Transactions that used it stay put — they just lose the tag.",
  },

  create_account: {
    band: () => "New account",
    headline: (v) => str(v.name),
    accent: () => "var(--gus-cyan)",
    fields: (v) => [
      { key: "name", label: "Name", kind: "text", placeholder: "e.g. Spending" },
      {
        key: "type",
        label: "Kind",
        kind: "select",
        options: [
          { value: "cash", label: "💵 Cash" },
          { value: "checking", label: "🏦 Checking" },
          { value: "savings", label: "🐷 Savings" },
          { value: "credit", label: "💳 Credit card" },
          { value: "debt", label: "👹 Debt / loan" },
          { value: "investment", label: "🌳 Investment" },
        ],
        half: v.type === "debt",
      },
      ...(v.type === "debt"
        ? [{ key: "startingBalance", label: "Owed now", kind: "money" as const, half: true }]
        : []),
    ],
    confirmLabel: "Add it",
    canSave: (v) => str(v.name).trim().length > 0 && str(v.type).length > 0,
  },

  set_currency: {
    band: () => "Change currency",
    headline: (v) => str(v.code),
    accent: () => "var(--gus-yellow)",
    fields: () => [
      {
        key: "code",
        label: "Currency",
        kind: "select",
        options: CURRENCIES.map((x) => ({ value: x.code, label: `${x.symbol} ${x.label}` })),
      },
    ],
    confirmLabel: "Switch",
    canSave: (v) => str(v.code).length > 0,
    // Worth saying plainly: nothing is converted, only relabelled.
    hint: () => CURRENCY_CHANGE_CAVEAT,
  },

  create_bill: {
    band: (v) => (v.recurrence === "once" ? "To pay once" : "Recurring bill"),
    headline: (v, c) => formatMoney(numOf(v.amount), c.currency),
    accent: () => "var(--gus-pink)",
    invertBand: () => true,
    fields: (v, c) => [
      {
        key: "recurrence",
        label: "",
        kind: "segmented",
        options: [
          { value: "monthly", label: "Every month" },
          { value: "once", label: "Just once" },
        ],
      },
      { key: "name", label: "What", kind: "text", placeholder: "e.g. Netflix", half: true },
      { key: "amount", label: "Amount", kind: "money", half: true },
      v.recurrence === "once"
        ? { key: "dueDate", label: "Due", kind: "date" as const }
        : { key: "dueDayOfMonth", label: "Due day of month", kind: "number" as const },
      {
        key: "remindDaysBefore",
        label: "Remind me (days before)",
        kind: "number",
        half: true,
      },
      {
        key: "accountId",
        label: "Pay from",
        kind: "select",
        options: accountOptions(c),
        emptyLabel: "Not set",
        half: true,
      },
    ],
    confirmLabel: "Add it",
    canSave: (v) =>
      str(v.name).trim().length > 0 &&
      numOf(v.amount) > 0 &&
      (v.recurrence === "once" ? !!str(v.dueDate) : true),
    hint: (v) => (v.recurrence === "once" && !str(v.dueDate) ? "When is it due?" : null),
  },

  mark_bill_paid: {
    band: () => "Mark as paid",
    headline: (v, c) => `${str(v.name)} · ${formatMoney(numOf(v.amount), c.currency)}`,
    accent: () => "var(--gus-lime)",
    fields: () => [],
    confirmLabel: "Mark paid",
    canSave: () => true,
    hint: () => "This also records the spend against the account it's paid from.",
  },

  set_bill_reminder: {
    band: () => "Bill reminder",
    headline: (v) => str(v.name),
    accent: () => "var(--gus-cyan)",
    fields: () => [
      { key: "daysBefore", label: "Days before it's due", kind: "number" },
    ],
    confirmLabel: "Save",
    canSave: () => true,
    hint: (v) => (numOf(v.daysBefore) <= 0 ? "Zero turns the reminder off." : null),
  },

  set_budget: {
    band: () => "Budget",
    headline: (v, c) => formatMoney(numOf(v.amount), c.currency),
    accent: () => "var(--gus-yellow)",
    fields: (v, c) => [
      {
        key: "period",
        label: "",
        kind: "segmented",
        options: [
          { value: "day", label: "A day" },
          { value: "week", label: "A week" },
          { value: "month", label: "A month" },
        ],
      },
      {
        key: "categoryId",
        label: "Category",
        kind: "select",
        options: categoryOptions(c),
        emptyLabel: "Choose…",
        half: true,
      },
      { key: "amount", label: "Limit", kind: "money", half: true },
    ],
    confirmLabel: "Set it",
    canSave: (v) => !!str(v.categoryId) && numOf(v.amount) > 0,
  },
};
