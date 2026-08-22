export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "NGN", symbol: "₦", label: "Nigerian Naira" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling" },
  { code: "GHS", symbol: "GH₵", label: "Ghanaian Cedi" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real" },
] as const;

// Changing this setting swaps the symbol; it does not convert stored amounts.
// Anything that offers the change should say so, or 100 dollars silently
// becomes 100 of something else.
export const CURRENCY_CHANGE_CAVEAT =
  "This changes the symbol shown, not the amounts already recorded.";

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value);
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";
}
