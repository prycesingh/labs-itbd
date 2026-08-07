"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

export const DashCard = ({
  number,
  name,
  subLabel,
  subString,
  numColor,
  onClick,
  uppercaseName = true,
  periodFilter,
  filterMenu,
}: {
  number: number | string | null;
  name: string;
  subLabel?: string;
  subString?: string;
  numColor?: string;
  onClick?: () => void;
  uppercaseName?: boolean;
  /** Legacy inline period-picker UI (kept for backward compatibility). */
  periodFilter?: React.ReactNode;
  /** Preferred filter UI rendered inside a 3-dot dropdown menu. */
  filterMenu?: React.ReactNode;
}) => {
  const [displayValue, setDisplayValue] = useState<number | string | null>(
    typeof number === "number" ? 0 : number,
  );
  const resolvedFilterMenu = filterMenu ?? periodFilter;
  const shouldShowSubString =
    Boolean(subString) &&
    number !== null &&
    !(typeof number === "string" && number.trim().toUpperCase() === "N/A");

  useEffect(() => {
    if (typeof number !== "number") {
      setDisplayValue(number);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const stepTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(number * eased * 100) / 100);

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayValue(number);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [number]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "itbd-glow-border relative flex flex-col overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md",
        onClick && "cursor-pointer",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10 flex h-full w-full flex-1 flex-col gap-4">
        <div>
          <div className="flex items-start gap-2">
            <p className="text-md flex-1 font-medium tracking-wide text-white/60">
              {uppercaseName ? name.toLocaleUpperCase() : name}
            </p>
            {resolvedFilterMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Open ${name} filters`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/60 transition-colors hover:border-itbd-blue hover:text-itbd-blue"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64"
                  onClick={(e) => e.stopPropagation()}
                >
                  {resolvedFilterMenu}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          {subLabel ? (
            <p className="mt-1 text-xs text-white/50">{subLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-1 items-end">
          <h2 className={cn("text-5xl font-semibold", numColor ?? "text-itbd-blue")}>
            <span>
              {typeof displayValue === "number"
                ? displayValue % 1 !== 0
                  ? displayValue.toFixed(2)
                  : displayValue
                : displayValue}
            </span>
            <span className="ml-2 text-[18px] font-normal text-white/50">
              {shouldShowSubString ? subString : ""}
            </span>
          </h2>
        </div>
      </div>
    </div>
  );
};
