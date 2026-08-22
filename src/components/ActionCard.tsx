"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { ACTIONS, type ActionContext, type Field, type Values } from "@/lib/actions";

// Renders any confirmable action from its descriptor. Styled as a bubble in
// the thread rather than a card: it sits inside the transcript's own card, and
// nesting one chunky border in another reads as a dialog that escaped its frame.
export default function ActionCard({
  action,
  values,
  context,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  action: string;
  values: Values;
  context: ActionContext;
  saving: boolean;
  error: string | null;
  onChange: (next: Values) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const descriptor = ACTIONS[action];
  const yesterday = new Date(Date.parse(`${context.today}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [pickingDate, setPickingDate] = useState(
    typeof values.date === "string" && values.date !== "" && values.date !== yesterday
  );

  if (!descriptor) return null;

  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  const fields = descriptor.fields(values, context);
  const canSave = !saving && descriptor.canSave(values);
  const hint = descriptor.hint?.(values, context) ?? null;
  const invert = descriptor.invertBand?.(values, context) ?? false;
  const bandColor = invert ? "#fff" : "var(--gus-navy)";

  // Half-width fields pair up; everything else takes the row.
  const rows: Field[][] = [];
  for (const field of fields) {
    const last = rows[rows.length - 1];
    if (field.half && last && last.length === 1 && last[0].half) last.push(field);
    else rows.push([field]);
  }

  return (
    <div
      data-testid="action-card"
      data-action={action}
      className="bubble-in w-[92%] overflow-hidden rounded-2xl border-3 border-navy"
      style={{ borderWidth: 3, backgroundColor: "#fff" }}
    >
      <div
        className="flex items-baseline justify-between gap-3 border-b-3 border-navy px-4 py-3"
        style={{ backgroundColor: descriptor.accent(values, context), borderBottomWidth: 3 }}
      >
        <span
          className="font-display text-sm uppercase tracking-[0.12em]"
          style={{ color: bandColor }}
        >
          {descriptor.band(values, context)}
        </span>
        {descriptor.headline && (
          <span
            className="font-display tnum truncate text-xl"
            style={{ color: bandColor }}
            data-testid="action-headline"
          >
            {descriptor.headline(values, context)}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {rows.map((row, i) => (
          <div key={i} className={row.length > 1 ? "flex gap-3" : ""}>
            {row.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                values={values}
                saving={saving}
                today={context.today}
                yesterday={yesterday}
                pickingDate={pickingDate}
                setPickingDate={setPickingDate}
                onSet={set}
                grow={row.length > 1}
              />
            ))}
          </div>
        ))}

        {error && (
          <p
            role="alert"
            className="rounded-xl px-3 py-2 text-sm text-white"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {error}
          </p>
        )}

        {hint && !error && <p className="text-sm text-ink-2">{hint}</p>}

        <div className="flex gap-2 pt-1">
          <button
            data-testid="action-save-btn"
            onClick={onSave}
            disabled={!canSave}
            className="chunky-btn font-display flex flex-1 items-center justify-center gap-2 py-2.5"
            style={{
              backgroundColor: descriptor.destructive ? "var(--gus-orange)" : "var(--gus-lime)",
              color: descriptor.destructive ? "#fff" : "var(--gus-navy)",
              borderRadius: 999,
            }}
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                <Icon name={descriptor.destructive ? "trash" : "check"} size={18} />
                {descriptor.confirmLabel}
              </>
            )}
          </button>
          <button
            data-testid="action-cancel-btn"
            onClick={onCancel}
            disabled={saving}
            className="chunky-btn font-display bg-white px-4 py-2.5 text-navy"
            style={{ borderRadius: 999 }}
          >
            Nope
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  values,
  saving,
  today,
  yesterday,
  pickingDate,
  setPickingDate,
  onSet,
  grow,
}: {
  field: Field;
  values: Values;
  saving: boolean;
  today: string;
  yesterday: string;
  pickingDate: boolean;
  setPickingDate: (v: boolean) => void;
  onSet: (key: string, value: unknown) => void;
  grow: boolean;
}) {
  const raw = values[field.key];
  const wrapper = grow ? "block min-w-0 flex-1" : "block";
  const label = field.label ? (
    <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
      {field.label}
    </span>
  ) : null;

  if (field.kind === "segmented") {
    return (
      <div className={wrapper}>
        {label}
        <div className="flex gap-2">
          {(field.options ?? []).map((option) => {
            const active = raw === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-testid={`field-${field.key}-${option.value}`}
                onClick={() => onSet(field.key, option.value)}
                disabled={saving}
                aria-pressed={active}
                className="font-display flex-1 rounded-full border-3 border-navy py-2 text-sm uppercase tracking-wide"
                style={{
                  borderWidth: 3,
                  backgroundColor: active ? "var(--gus-navy)" : "#fff",
                  color: active ? "#fff" : "var(--gus-navy)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Almost every entry is today or yesterday, and a permanent date field costs
  // a row plus the browser's own mm/dd/yyyy chrome inside a hand-drawn card.
  if (field.kind === "dateChips") {
    const value = typeof raw === "string" && raw ? raw : null;
    const choice = value === null ? "today" : value === yesterday ? "yesterday" : "other";
    const chip = (key: string, text: string, onClick: () => void) => (
      <button
        key={key}
        type="button"
        data-testid={`field-${field.key}-${key}`}
        onClick={onClick}
        disabled={saving}
        aria-pressed={choice === key}
        className="rounded-full border-2 px-3 py-1.5 text-sm"
        style={{
          borderColor:
            choice === key ? "var(--gus-navy)" : "color-mix(in srgb, var(--gus-navy) 25%, transparent)",
          backgroundColor: choice === key ? "var(--gus-navy)" : "transparent",
          color: choice === key ? "#fff" : "var(--gus-ink-2)",
        }}
      >
        {text}
      </button>
    );
    return (
      <div className={wrapper}>
        {label}
        <div className="flex flex-wrap items-center gap-2">
          {chip("today", "Today", () => {
            setPickingDate(false);
            onSet(field.key, null);
          })}
          {chip("yesterday", "Yesterday", () => {
            setPickingDate(false);
            onSet(field.key, yesterday);
          })}
          {chip("other", "Other", () => setPickingDate(true))}
        </div>
        {pickingDate && (
          <input
            data-testid={`field-${field.key}-picker`}
            type="date"
            max={today}
            value={value ?? ""}
            onChange={(e) => onSet(field.key, e.target.value || null)}
            disabled={saving}
            aria-label="Pick a date"
            className="chunky-field chunky-field--date mt-2 text-sm"
          />
        )}
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <label className={wrapper}>
        {label}
        <select
          data-testid={`field-${field.key}`}
          value={typeof raw === "string" ? raw : ""}
          onChange={(e) => onSet(field.key, e.target.value || null)}
          disabled={saving}
          className="chunky-field chunky-field--select"
        >
          {field.emptyLabel && <option value="">{field.emptyLabel}</option>}
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "money" || field.kind === "number") {
    return (
      <label className={wrapper}>
        {label}
        <input
          data-testid={`field-${field.key}`}
          type="number"
          inputMode="decimal"
          min="0"
          step={field.kind === "money" ? "0.01" : "1"}
          value={raw === null || raw === undefined || raw === "" ? "" : String(raw)}
          onChange={(e) => onSet(field.key, e.target.value === "" ? null : Number(e.target.value))}
          disabled={saving}
          className={`chunky-field tnum ${field.kind === "money" ? "font-display text-xl" : ""}`}
        />
      </label>
    );
  }

  if (field.kind === "date") {
    return (
      <label className={wrapper}>
        {label}
        <input
          data-testid={`field-${field.key}`}
          type="date"
          value={typeof raw === "string" ? raw : ""}
          onChange={(e) => onSet(field.key, e.target.value || null)}
          disabled={saving}
          className="chunky-field chunky-field--date text-sm"
        />
      </label>
    );
  }

  if (field.kind === "emoji") {
    return (
      <label className="block w-20 shrink-0">
        {label}
        <input
          data-testid={`field-${field.key}`}
          value={typeof raw === "string" ? raw : ""}
          onChange={(e) => onSet(field.key, [...e.target.value].slice(0, 4).join(""))}
          disabled={saving}
          aria-label="Emoji"
          className="chunky-field text-center text-2xl"
        />
      </label>
    );
  }

  return (
    <label className={wrapper}>
      {label}
      <input
        data-testid={`field-${field.key}`}
        value={typeof raw === "string" ? raw : ""}
        onChange={(e) => onSet(field.key, e.target.value)}
        maxLength={80}
        placeholder={field.placeholder}
        disabled={saving}
        className="chunky-field"
      />
    </label>
  );
}
