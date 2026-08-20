// Turns a plain-language chat message into a draft the user can confirm --
// either a transaction ("spent 12 on lunch") or a new category ("add a
// category for pets") -- or decides it is neither and should just be answered.
//
// This is a separate non-streaming pass rather than tool/function calling on
// purpose: `client.ts` is deliberately provider-agnostic OpenAI-compatible
// chat-completions, and `tools` support across such endpoints is uneven. One
// small JSON round-trip keeps the "swap providers via env" promise intact.
//
// The model picks accounts and categories by LIST NUMBER, never by id -- ids
// are UUIDs, and models copy 36-char hex strings unreliably. Numbers are
// resolved back to ids here, so a bad number degrades to "unspecified"
// instead of a hallucinated foreign key.
//
// It also sees only the current message, not chat history. A draft is
// confirmed on a card the user can edit, so "make that 15" is a correction
// on the card, not a second parse -- which keeps this pass deterministic.

import { getChatCompletion, type ChatMessage } from "./client";
import type { AccountSummary, Category, CategoryDraft, TransactionDraft } from "../types";

export type ChatIntent =
  | { kind: "transaction"; draft: TransactionDraft }
  | { kind: "category"; draft: CategoryDraft };

type ParsedIntent = {
  kind?: unknown;
  type?: unknown;
  amount?: unknown;
  description?: unknown;
  account?: unknown;
  category?: unknown;
  name?: unknown;
  emoji?: unknown;
  date?: unknown;
};

const FALLBACK_EMOJI = "🏷️";

function buildPrompt(
  accounts: AccountSummary[],
  categories: Category[],
  currency: string,
  today: string
): string {
  const accountList = accounts.map((a, i) => `${i + 1}. ${a.name} (${a.type})`).join("\n");
  const categoryList =
    categories.length > 0
      ? categories.map((c, i) => `${i + 1}. ${c.emoji} ${c.name}`).join("\n")
      : "(none defined)";

  return [
    "You classify a single message from someone using a personal finance app.",
    "Decide whether they are RECORDING money they made or spent, or doing anything else",
    "(asking a question, chatting, greeting you, reacting).",
    "",
    'Reply with ONLY a JSON object. No markdown fences, no commentary.',
    "",
    "If they are recording money:",
    '{"kind":"log","type":"make"|"spend","amount":<number>,"description":"<short label>","account":<number|null>,"category":<number|null>,"date":"YYYY-MM-DD"|null}',
    "",
    "If they are explicitly asking to create a new spending category:",
    '{"kind":"category","name":"<short name>","emoji":"<one emoji>"}',
    "",
    "For anything else:",
    '{"kind":"chat"}',
    "",
    "Accounts (answer with the number):",
    accountList,
    "",
    "Categories (answer with the number):",
    categoryList,
    "",
    `Today's date is ${today}.`,
    "",
    "Rules:",
    `- amount is a positive number in ${currency}: digits only, no currency symbol, no thousands separators.`,
    '- "made", "earned", "got paid", "received", "found", "allowance" mean type "make".',
    '- "spent", "bought", "paid", "paid for", "gave" mean type "spend".',
    "- description is 1-4 words for what it was for, with no amount in it.",
    "- account is the number of the account they named, or null if they named none.",
    "- category is the best-fitting number, or null if none fits.",
    '- If there is no clear single amount, answer {"kind":"chat"} -- never guess an amount.',
    '- If the message both asks something and mentions a past amount, answer {"kind":"chat"}.',
    '- date: only set it when they say when it happened ("yesterday", "last Monday",',
    '  "on the 3rd"). Resolve it against today\'s date into a real calendar day. If they',
    "  don't say when, use null -- do not guess, and do not fill in today.",
    "- The date is the LEAST important field. If you cannot work out which day they mean,",
    '  still answer {"kind":"log"} with "date":null. Never downgrade a log to',
    '  {"kind":"chat"} just because the date is unclear.',
    '- Something they have not done yet is not a log: "I\'ll spend 100 next week", "I want',
    '  to buy a bike" and "saving up for shoes" are all {"kind":"chat"}. Only record money',
    "  that has already moved.",
    '- Only answer {"kind":"category"} when they actually ask for a category to be added',
    '  ("add a category for pets", "can you make a travel category"). Merely mentioning a',
    '  kind of spending ("I spend a lot on pets") is {"kind":"chat"}.',
    "- A category name is 1-3 words. Pick one emoji that suits it.",
    '- Recording money wins over creating a category: "spent 20 on pet food" is a log, even if',
    "  no pet category exists yet.",
  ].join("\n");
}

// Models wrap JSON in prose or fences often enough that this is worth doing
// rather than trusting a bare JSON.parse.
function parseJsonObject(raw: string): ParsedIntent | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as ParsedIntent) : null;
  } catch {
    return null;
  }
}

// Accept only a real past-or-today calendar day. Anything else (a bad shape, a
// future date, a date the model invented from nothing) becomes null, which
// means "now" -- the safe default rather than a wrong timestamp.
const MAX_BACKDATE_DAYS = 3650;

function normalizeDate(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Round-trip guards against overflow like 2026-02-31 silently becoming March.
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  if (value > today) return null;

  const ageDays = (Date.parse(`${today}T00:00:00Z`) - parsed.getTime()) / 86_400_000;
  if (ageDays > MAX_BACKDATE_DAYS) return null;

  return value === today ? null : value;
}

function resolveIndex<T>(value: unknown, list: T[]): T | null {
  const index = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(index) || index < 1 || index > list.length) return null;
  return list[index - 1];
}

export async function extractChatIntent(
  message: string,
  opts: {
    accounts: AccountSummary[];
    categories: Category[];
    currency: string;
    defaultAccountId: string | null;
  }
): Promise<ChatIntent | null> {
  const { accounts, categories, currency, defaultAccountId } = opts;
  if (accounts.length === 0) return null;

  // Server clock, UTC. The date only ever seeds the draft, and the user sees
  // and can change it on the confirmation card before anything is written.
  const today = new Date().toISOString().slice(0, 10);

  const messages: ChatMessage[] = [
    { role: "system", content: buildPrompt(accounts, categories, currency, today) },
    { role: "user", content: message },
  ];

  const raw = await getChatCompletion(messages);
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;

  if (parsed.kind === "category") {
    const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 40) : "";
    if (!name) return null;
    // Emoji arrive as multi-code-point sequences (skin tones, ZWJ), so cap by
    // code point rather than truncating mid-sequence into a broken glyph.
    const emojiRaw = typeof parsed.emoji === "string" ? parsed.emoji.trim() : "";
    const emoji = emojiRaw ? [...emojiRaw].slice(0, 4).join("") : FALLBACK_EMOJI;
    return { kind: "category", draft: { name, emoji } };
  }

  if (parsed.kind !== "log") return null;
  if (parsed.type !== "make" && parsed.type !== "spend") return null;

  const amount = typeof parsed.amount === "number" ? parsed.amount : Number(parsed.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const named = resolveIndex(parsed.account, accounts);
  // Fall back to the configured default, then -- only if there is exactly one
  // account -- to that. With several accounts and no hint, leave it unset so
  // the confirmation card asks instead of quietly picking wrong.
  const fallback =
    accounts.find((a) => a.id === defaultAccountId) ?? (accounts.length === 1 ? accounts[0] : null);

  const description =
    typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim().slice(0, 80)
      : "";

  return {
    kind: "transaction",
    draft: {
      type: parsed.type,
      amount: Math.round(amount * 100) / 100,
      description,
      accountId: (named ?? fallback)?.id ?? null,
      categoryId: resolveIndex(parsed.category, categories)?.id ?? null,
      date: normalizeDate(parsed.date, today),
    },
  };
}
