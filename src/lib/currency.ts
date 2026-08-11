export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "NGN", symbol: "₦", label: "Nigerian Naira" },
  { code: "GBP", symbol: "£", label: "British Pound" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value);
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";
}
