"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { centsToInputValue, parseMoneyToCents } from "@/lib/format";

/**
 * Decimal price entry that submits integer cents. The visible input is typed as "95.50";
 * a hidden input named `name` carries the cents (empty when the text isn't a valid price).
 */
export function MoneyInput({
  id,
  name,
  defaultCents,
  form,
  className,
  "aria-label": ariaLabel,
}: {
  id: string;
  name: string;
  defaultCents?: number;
  form?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(defaultCents === undefined ? "" : centsToInputValue(defaultCents));
  const cents = parseMoneyToCents(text);

  return (
    <>
      <Input
        id={id}
        form={form}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={ariaLabel}
        aria-invalid={text !== "" && cents === null ? true : undefined}
        className={className}
      />
      <input type="hidden" name={name} form={form} value={cents ?? ""} />
    </>
  );
}
