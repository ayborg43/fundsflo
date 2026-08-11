"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; cta: string; switchPrompt: string; switchHref: string; switchLabel: string }> = {
  login: {
    title: "WELCOME BACK!",
    cta: "LOG IN",
    switchPrompt: "New here?",
    switchHref: "/register",
    switchLabel: "Create an account",
  },
  register: {
    title: "LET'S GET STARTED!",
    cta: "SIGN UP",
    switchPrompt: "Already have an account?",
    switchHref: "/login",
    switchLabel: "Log in",
  },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <header className="flex justify-center mb-6">
        <h1 className="font-display text-4xl sm:text-5xl text-navy tracking-tight">
          FREEZE FUND
        </h1>
      </header>

      <div
        data-testid={`${mode}-form-card`}
        className="chunky-card p-6 sm:p-7"
        style={{ backgroundColor: "var(--gus-cream)" }}
      >
        <h2 className="font-display text-2xl sm:text-3xl text-navy mb-4 text-center">
          {copy.title}
        </h2>

        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="font-display text-sm text-navy block mb-1">Email</label>
            <input
              data-testid="email-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>

          <div>
            <label className="font-display text-sm text-navy block mb-1">Password</label>
            <input
              data-testid="password-input"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="font-display text-sm text-navy block mb-1">Confirm password</label>
              <input
                data-testid="confirm-password-input"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type it again"
                className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
                style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
              />
            </div>
          )}

          {error && (
            <div
              data-testid="auth-error"
              className="font-display text-sm text-white px-4 py-2 rounded-2xl border-3 border-navy"
              style={{ backgroundColor: "var(--gus-orange)", borderWidth: 3 }}
            >
              {error}
            </div>
          )}

          <button
            data-testid="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="chunky-btn w-full py-4 text-xl sm:text-2xl text-navy"
            style={{ backgroundColor: "var(--gus-lime)" }}
          >
            {submitting ? "..." : copy.cta}
          </button>
        </form>

        <p className="font-display text-sm text-navy/70 text-center mt-4">
          {copy.switchPrompt}{" "}
          <Link href={copy.switchHref} className="text-navy underline">
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
