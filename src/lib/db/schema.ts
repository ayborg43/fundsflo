import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  currency: text("currency").notNull().default("USD"),
  // Where a chat-logged transaction lands when the user doesn't name an
  // account. Deliberately carries no foreign key: users -> accounts -> users
  // would be a cycle, and every read has to re-check the account still exists
  // and still belongs to this user anyway, so a dangling id costs nothing.
  defaultAccountId: uuid("default_account_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountTypes = [
  "cash",
  "checking",
  "savings",
  "credit",
  "debt",
  "investment",
] as const;

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: accountTypes }).notNull(),
  // Only meaningful for debt-type accounts: the original amount owed, used
  // to compute payoff progress. Null for asset-type accounts.
  startingBalance: numeric("starting_balance", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  type: text("type", { enum: ["make", "spend"] }).notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  description: text("description").notNull().default(""),
  tag: text("tag"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetPeriods = ["day", "week", "month"] as const;

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  // Spend allowed per period. Weeks are calendar weeks (Monday-based) and
  // months calendar months, so "am I over budget?" doesn't answer differently
  // every day the way a rolling window would.
  period: text("period", { enum: budgetPeriods }).notNull().default("month"),
  limitAmount: numeric("limit_amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billRecurrences = ["monthly", "once"] as const;

// Covers both a recurring bill and a one-off thing you owe. They differ only
// in when they fall due, so they stay one concept rather than two near
// identical tables that drift apart.
export const recurringBills = pgTable("recurring_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  recurrence: text("recurrence", { enum: billRecurrences }).notNull().default("monthly"),
  // Monthly bills use the day of the month; one-off payments use the date.
  // Exactly one is set, decided by `recurrence`.
  dueDayOfMonth: numeric("due_day_of_month", { mode: "number" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  // Null means no reminder wanted. Otherwise, how many days ahead to nudge.
  remindDaysBefore: numeric("remind_days_before", { mode: "number" }),
  lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
  lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per browser that agreed to receive reminders. Endpoints are unique;
// a browser re-subscribing replaces its own row rather than adding another.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Uploaded bank/card statements (CSV or Excel). Analysis-only: this never
// creates transactions -- rawContent is handed to the AI for commentary,
// nothing here touches the accounts/transactions ledger.
export const statements = pgTable("statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  rawContent: text("raw_content").notNull(),
  analysis: text("analysis"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
