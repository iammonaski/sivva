"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? (
          <EyeSlash size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
