"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

const INDUSTRY_OPTIONS = [
  "Retail",
  "Manufacturing",
  "Services",
  "Technology",
  "Healthcare",
  "Education",
  "Food & Beverage",
  "Construction",
  "Logistics",
  "Finance",
  "Other",
];

const BUSINESS_TYPE_OPTIONS = [
  "Sole Proprietorship",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
  "Startup",
  "Non-profit",
  "Other",
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
];

const COUNTRY_OPTIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Switzerland",
  "United Arab Emirates",
  "Singapore",
  "Germany",
  "France",
  "Other",
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
  children: React.ReactNode;
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

function inputStyle() {
  return {
    border: "1px solid var(--color-border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--color-text-primary)",
    borderRadius: 14,
    padding: "12px 13px",
    outline: "none",
    fontSize: 14,
    width: "100%",
  };
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

        <FieldLabel
          label="Industry"
          hint="Helps AI understand revenue, cost, and risk patterns."
        >
          <select
            value={values.industry}
            onChange={(event) => updateField("industry", event.target.value)}
            style={inputStyle()}
          >
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel
          label="Business type"
          hint="Useful for financial profile and compliance context."
        >
          <select
            value={values.businessType}
            onChange={(event) =>
              updateField("businessType", event.target.value)
            }
            style={inputStyle()}
          >
            <option value="">Select business type</option>
            {BUSINESS_TYPE_OPTIONS.map((businessType) => (
              <option key={businessType} value={businessType}>
                {businessType}
              </option>
            ))}
          </select>
        </FieldLabel>

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

        <FieldLabel
          label="Currency"
          hint="Default currency for dashboard and reports."
        >
          <select
            value={values.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            style={inputStyle()}
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel
          label="Country"
          hint="Helps AI understand taxes, filings, and business context."
        >
          <select
            value={values.country}
            onChange={(event) => updateField("country", event.target.value)}
            style={inputStyle()}
          >
            <option value="">Select country</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </FieldLabel>
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