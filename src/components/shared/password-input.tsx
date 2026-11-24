"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-12", className)}
      />
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 h-full w-11 text-muted-foreground md:h-full md:w-10"
      >
        {visible ? (
          <EyeSlash size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
