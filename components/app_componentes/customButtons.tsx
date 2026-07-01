import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React, { forwardRef } from "react";
import { Button } from "../ui/button";

export type DefaultButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    children: React.ReactNode;
    size?:
      | "default"
      | "sm"
      | "lg"
      | "xs"
      | "icon"
      | "icon-xs"
      | "icon-sm"
      | "icon-lg"
      | null
      | undefined;
    asChild?: boolean;
  };

const DefaultButton = forwardRef<HTMLButtonElement, DefaultButtonProps>(
  (
    {
      children,
      className,
      disabled,
      loading,
      size,
      asChild = false,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <Button
        ref={ref}
        type={type}
        size={size ? size : "lg"}
        disabled={isDisabled}
        className={cn(className)}
        asChild={asChild}
        {...rest}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="sr-only">Loading</span>
          </span>
        ) : (
          children
        )}
      </Button>
    );
  },
);

export const GreenButton = forwardRef<HTMLButtonElement, DefaultButtonProps>(
  (
    {
      children,
      className,
      disabled,
      loading,
      asChild = false,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <Button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(className)}
        variant="outline"
        asChild={asChild}
        {...rest}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="sr-only">Loading</span>
          </span>
        ) : (
          children
        )}
      </Button>
    );
  },
);

GreenButton.displayName = "GreenButton";
DefaultButton.displayName = "DefaultButton";

export default DefaultButton;
