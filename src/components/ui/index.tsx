// Small shared building blocks. Server-safe (no hooks), so any page can use them.

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariant: Record<Variant, string> = {
  primary: "bg-green text-white hover:bg-green-dark",
  secondary: "border border-line bg-surface text-ink hover:border-ink/30",
  ghost: "text-green-dark hover:bg-green-soft",
};
const buttonSize: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cx(buttonBase, buttonVariant[variant], buttonSize[size], className)}
      {...props}
    />
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      className={cx(buttonBase, buttonVariant[variant], buttonSize[size], className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

type Tone = "neutral" | "green" | "sun" | "warn" | "bad";
const badgeTone: Record<Tone, string> = {
  neutral: "bg-paper text-muted border border-line",
  green: "bg-green-soft text-green-dark",
  sun: "bg-sun-soft text-ink",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgeTone[tone],
        className,
      )}
      {...props}
    />
  );
}

/** value is 0-100. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className="h-full rounded-full bg-sun transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** A labelled figure, e.g. "Earned so far / $12.40". */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-3 text-lg text-muted">{intro}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Inline message for errors and empty states. */
export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "bad";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-surface text-muted",
    warn: "border-warn/30 bg-warn-soft text-warn",
    bad: "border-bad/30 bg-bad-soft text-bad",
  };
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      className={cx("rounded-card border px-4 py-3 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}
