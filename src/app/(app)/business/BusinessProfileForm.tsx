"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";

type BusinessProfileFields = {
  name: string;
  industry: string;
  businessType: string;
  financialYear: string;
  currency: string;
  country: string;
};

type BusinessProfileFormProps = {
  initialValues: BusinessProfileFields;
  hasBusinessProfile: boolean;
};

type SelectOption = {
  value: string;
  label: string;
};

const INDUSTRY_OPTIONS: SelectOption[] = [
  { value: "Retail", label: "Retail" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Services", label: "Services" },
  { value: "Technology", label: "Technology" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Education", label: "Education" },
  { value: "Food & Beverage", label: "Food & Beverage" },
  { value: "Construction", label: "Construction" },
  { value: "Logistics", label: "Logistics" },
  { value: "Finance", label: "Finance" },
  { value: "Other", label: "Other" },
];

const BUSINESS_TYPE_OPTIONS: SelectOption[] = [
  { value: "Sole Proprietorship", label: "Sole Proprietorship" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "Private Limited", label: "Private Limited" },
  { value: "Public Limited", label: "Public Limited" },
  { value: "Startup", label: "Startup" },
  { value: "Non-profit", label: "Non-profit" },
  { value: "Other", label: "Other" },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
];

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: "India", label: "India" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Switzerland", label: "Switzerland" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
  { value: "Singapore", label: "Singapore" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Other", label: "Other" },
];

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while saving business profile.";
}

async function readApiError(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    return "Business profile update failed.";
  } catch {
    return "Business profile update failed.";
  }
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      <span
        style={{
          color: "var(--color-text-primary)",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {label}
      </span>

      {children}

      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </span>
    </label>
  );
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      <span
        style={{
          color: "var(--color-text-primary)",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {label}
      </span>

      {children}

      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </span>
    </div>
  );
}

function inputStyle(): CSSProperties {
  return {
    border: "1px solid var(--color-border)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
    color: "var(--color-text-primary)",
    borderRadius: 14,
    padding: "12px 13px",
    outline: "none",
    fontSize: 14,
    width: "100%",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
}

function ThemedSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocusedElement = event.relatedTarget as Node | null;

    if (
      nextFocusedElement &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    setIsOpen(false);
  }

  return (
    <div
      onBlur={handleBlur}
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          width: "100%",
          border: isOpen
            ? "1px solid rgba(245,158,11,0.55)"
            : "1px solid var(--color-border)",
          background: isOpen
            ? "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(255,255,255,0.04))"
            : "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
          color: selectedOption
            ? "var(--color-text-primary)"
            : "var(--color-text-muted)",
          borderRadius: 14,
          padding: "12px 13px",
          outline: "none",
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          textAlign: "left",
          boxShadow: isOpen
            ? "0 0 0 1px rgba(245,158,11,0.16), 0 18px 45px rgba(0,0,0,0.20)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <span
          style={{
            color: "var(--color-amber)",
            fontSize: 13,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "0.18s ease",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            border: "1px solid rgba(245,158,11,0.28)",
            background:
              "linear-gradient(180deg, rgba(18,24,33,0.98), rgba(10,15,22,0.98))",
            color: "var(--color-text-primary)",
            borderRadius: 16,
            padding: 8,
            display: "grid",
            gap: 5,
            maxHeight: 260,
            overflowY: "auto",
            boxShadow:
              "0 22px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  border: isSelected
                    ? "1px solid rgba(245,158,11,0.42)"
                    : "1px solid transparent",
                  background: isSelected
                    ? "rgba(245,158,11,0.14)"
                    : "rgba(255,255,255,0.025)",
                  color: isSelected
                    ? "var(--color-amber)"
                    : "var(--color-text-primary)",
                  borderRadius: 12,
                  padding: "10px 11px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isSelected ? 900 : 700,
                  lineHeight: 1.35,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BusinessProfileForm({
  initialValues,
  hasBusinessProfile,
}: BusinessProfileFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<BusinessProfileFields>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof BusinessProfileFields, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    setMessage(null);
    setError(null);

    if (!values.name.trim()) {
      setError("Business name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/business", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        setError(apiError);
        return;
      }

      setMessage("Business profile saved successfully.");
      router.refresh();
    } catch (saveError) {
      setError(readErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <FieldLabel
          label="Business name"
          hint="This name will appear in reports and finance context."
        >
          <input
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Example: Aditya Enterprises"
            required
            style={inputStyle()}
          />
        </FieldLabel>

        <FieldShell
          label="Industry"
          hint="Helps AI understand revenue, cost, and risk patterns."
        >
          <ThemedSelect
            value={values.industry}
            options={INDUSTRY_OPTIONS}
            placeholder="Select industry"
            onChange={(value) => updateField("industry", value)}
          />
        </FieldShell>

        <FieldShell
          label="Business type"
          hint="Useful for financial profile and compliance context."
        >
          <ThemedSelect
            value={values.businessType}
            options={BUSINESS_TYPE_OPTIONS}
            placeholder="Select business type"
            onChange={(value) => updateField("businessType", value)}
          />
        </FieldShell>

        <FieldLabel
          label="Financial year"
          hint="Example: 2024-25, FY 2025, Jan-Dec 2024."
        >
          <input
            value={values.financialYear}
            onChange={(event) =>
              updateField("financialYear", event.target.value)
            }
            placeholder="2024-25"
            style={inputStyle()}
          />
        </FieldLabel>

        <FieldShell
          label="Currency"
          hint="Default currency for dashboard and reports."
        >
          <ThemedSelect
            value={values.currency}
            options={CURRENCY_OPTIONS}
            placeholder="Select currency"
            onChange={(value) => updateField("currency", value)}
          />
        </FieldShell>

        <FieldShell
          label="Country"
          hint="Helps AI understand taxes, filings, and business context."
        >
          <ThemedSelect
            value={values.country}
            options={COUNTRY_OPTIONS}
            placeholder="Select country"
            onChange={(value) => updateField("country", value)}
          />
        </FieldShell>
      </div>

      {message && (
        <div
          style={{
            border: "1px solid rgba(46,213,115,0.30)",
            background: "rgba(46,213,115,0.09)",
            color: "#7bed9f",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            border: "1px solid rgba(255,71,87,0.30)",
            background: "rgba(255,71,87,0.09)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="submit"
          disabled={isSaving}
          style={{
            border: "none",
            background: "linear-gradient(135deg, var(--color-amber), #ffd166)",
            color: "var(--color-base)",
            borderRadius: 14,
            padding: "12px 15px",
            cursor: isSaving ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 950,
            opacity: isSaving ? 0.7 : 1,
            boxShadow: "0 16px 40px rgba(245,158,11,0.16)",
          }}
        >
          {isSaving
            ? "Saving..."
            : hasBusinessProfile
              ? "Update business profile"
              : "Create business profile"}
        </button>

        <span
          style={{
            color: "var(--color-text-muted)",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          This information improves dashboard, reports, and AI finance answers.
        </span>
      </div>
    </form>
  );
}