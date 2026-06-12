import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Minimal UI primitives. This is the single swap point for the Phrase design system:
 * when the internal component library is available, re-implement these against it and
 * the rest of the app is unchanged.
 */

export function Button({
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark'
      : 'bg-transparent text-brand hover:bg-brand/10';
  return (
    <button className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return <div className="animate-pulse text-gray-400">Loading…</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
      {children}
    </span>
  );
}
