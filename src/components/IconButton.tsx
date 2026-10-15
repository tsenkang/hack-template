"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  active?: boolean;
}

/** Botão só com ícone. O `label` vira dica (tooltip) e nome acessível para leitores de tela. */
export function IconButton({ label, children, active, className, ...rest }: Props) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-fg transition-colors",
        "hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-accent-soft text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
