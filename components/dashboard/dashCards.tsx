"use client";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <Card onClick={onClick} className="flex flex-col rounded-lg p-3">
      <CardContent className="flex flex-1 items-center justify-center px-2">
        <div className="flex h-full w-full flex-1 flex-col gap-4">
          <div>
            <div className="flex items-start gap-2">
              <p className="text-md flex-1 text-muted-foreground">
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
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:text-foreground"
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
              <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
            ) : null}
          </div>
          <div className="flex flex-1 items-end">
            <h2 className={`text-5xl font-light ${numColor ?? "text-foreground"}`}>
              <span>
                {typeof displayValue === "number"
                  ? displayValue % 1 !== 0
                    ? displayValue.toFixed(2)
                    : displayValue
                  : displayValue}
              </span>
              <span className="ml-2 text-[18px] font-normal text-muted-foreground">
                {shouldShowSubString ? subString : ""}
              </span>
            </h2>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
