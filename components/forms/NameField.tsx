"use client";

import { Field, inputClass } from "@/components/ui";

/**
 * Free-text name entry.
 *
 * The plant asked for this over a staff dropdown. It means the dashboard
 * groups on whatever is typed, so "R. Verma" and "Ramesh Verma" count as two
 * people; entries are normalised (trimmed, inner spaces collapsed, upper-cased
 * for grouping only) to absorb the easy cases.
 */
export function NameField({
  value,
  onChange,
  label = "Your name",
  labelHi = "आपका नाम",
  error,
  optional = false,
  placeholder = "Type your full name / पूरा नाम लिखें",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  labelHi?: string;
  error?: string | null;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <Field
      label={
        <>
          {label} <span className="hi text-muted">/ {labelHi}</span>
        </>
      }
      required={!optional}
      hint={optional ? "optional" : undefined}
      error={error}
    >
      <input
        type="text"
        className={inputClass}
        placeholder={placeholder}
        autoComplete="name"
        maxLength={80}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
