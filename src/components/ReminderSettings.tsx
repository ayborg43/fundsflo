"use client";

import { useEffect, useState } from "react";

// VAPID keys travel as base64url; the browser wants raw bytes.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  // Backed by a plain ArrayBuffer so it satisfies BufferSource; the default
  // Uint8Array type also admits SharedArrayBuffer, which pushManager rejects.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type State = { configured: boolean; publicKey: string | null; devices: number };

export default function ReminderSettings() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribedHere, setSubscribedHere] = useState(false);

  useEffect(() => {
    fetch("/api/push/subscribe")
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => setState({ configured: false, publicKey: null, devices: 0 }));

    // Whether *this* browser is signed up is a browser fact, not a server one.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribedHere(Boolean(sub)))
        .catch(() => setSubscribedHere(false));
    }
  }, []);

  async function enable() {
    if (!state?.publicKey) return;
    setBusy(true);
    setError(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("This browser can't do reminders.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are blocked for this site.");
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(state.publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not turn reminders on");
      setSubscribedHere(true);
      setState((prev) => (prev ? { ...prev, devices: data.devices ?? prev.devices } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn reminders on");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribedHere(false);
      setState((prev) => (prev ? { ...prev, devices: Math.max(0, prev.devices - 1) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn reminders off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-xl text-navy mb-1 mt-6">Bill reminders</h2>

      {state && !state.configured ? (
        <p className="font-display text-sm text-ink-2">
          Reminders aren&rsquo;t set up on this server yet. Ask whoever deployed it to add VAPID
          keys.
        </p>
      ) : (
        <>
          <p className="font-display text-sm text-ink-2 mb-3">
            Get a nudge before a bill is due. Ask in the chat for a reminder on any bill, then
            switch it on for this device.
          </p>
          <button
            data-testid="toggle-reminders-btn"
            onClick={subscribedHere ? disable : enable}
            disabled={busy || !state}
            className="chunky-btn py-3 px-4 text-lg w-full"
            style={{ backgroundColor: subscribedHere ? "var(--gus-lime)" : "white" }}
          >
            {busy
              ? "Just a sec…"
              : subscribedHere
                ? "✓ On for this device"
                : "Turn on for this device"}
          </button>
          {state && state.devices > 0 && (
            <p className="font-display text-xs text-ink-2 mt-2">
              {state.devices} device{state.devices === 1 ? "" : "s"} signed up.
            </p>
          )}
          <p className="font-display text-xs text-ink-2 mt-2">
            On iPhone this only works once FundsFlow is added to your home screen.
          </p>
        </>
      )}

      {error && (
        <p
          className="font-display text-sm text-white mt-2 text-center rounded-2xl py-2"
          style={{ backgroundColor: "var(--gus-orange)" }}
        >
          {error}
        </p>
      )}
    </>
  );
}
