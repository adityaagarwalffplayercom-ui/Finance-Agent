"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type BusinessProfile = {
  name?: string | null;
  industry?: string | null;
  businessType?: string | null;
  financialYear?: string | null;
  currency?: string | null;
  country?: string | null;
};

type BusinessProfileFormProps = {
  business?: BusinessProfile | null;
  initialBusiness?: BusinessProfile | null;
  initialValues?: BusinessProfile | null;
  hasBusinessProfile?: boolean;
};

type FormState = {
  type: "idle" | "success" | "error";
  message: string;
};

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
};

const INDUSTRY_OPTIONS: SelectOption[] = [
  {
    value: "Retail",
    label: "Retail",
    description: "Shops, stores, consumer goods, trading",
    icon: "🛍️",
  },
  {
    value: "Manufacturing",
    label: "Manufacturing",
    description: "Production, factory, plant operations",
    icon: "🏭",
  },
  {
    value: "Services",
    label: "Services",
    description: "Consulting, agencies, professional services",
    icon: "🤝",
  },
  {
    value: "Technology",
    label: "Technology",
    description: "Software, SaaS, IT services, digital products",
    icon: "💻",
  },
  {
    value: "Healthcare",
    label: "Healthcare",
    description: "Clinics, pharma, medical services",
    icon: "🏥",
  },
  {
    value: "Education",
    label: "Education",
    description: "Schools, coaching, training institutes",
    icon: "🎓",
  },
  {
    value: "Food & Beverage",
    label: "Food & Beverage",
    description: "Restaurants, cafes, catering, packaged food",
    icon: "🍽️",
  },
  {
    value: "Real Estate",
    label: "Real Estate",
    description: "Property, rent, construction, brokerage",
    icon: "🏢",
  },
  {
    value: "Logistics",
    label: "Logistics",
    description: "Transport, delivery, warehousing",
    icon: "🚚",
  },
  {
    value: "Finance",
    label: "Finance",
    description: "Accounting, lending, advisory, investments",
    icon: "💰",
  },
  {
    value: "Agriculture",
    label: "Agriculture",
    description: "Farming, agribusiness, food supply",
    icon: "🌾",
  },
  {
    value: "Energy",
    label: "Energy",
    description: "Power, renewables, utilities",
    icon: "⚡",
  },
  {
    value: "Other",
    label: "Other",
    description: "Any other business industry",
    icon: "📌",
  },
];

const BUSINESS_TYPE_OPTIONS: SelectOption[] = [
  {
    value: "Sole Proprietorship",
    label: "Sole Proprietorship",
    description: "Single owner business",
    icon: "👤",
  },
  {
    value: "Partnership",
    label: "Partnership",
    description: "Business owned by partners",
    icon: "🤝",
  },
  {
    value: "LLP",
    label: "LLP",
    description: "Limited Liability Partnership",
    icon: "📘",
  },
  {
    value: "Private Limited",
    label: "Private Limited",
    description: "Registered private company",
    icon: "🏛️",
  },
  {
    value: "Public Limited",
    label: "Public Limited",
    description: "Public company structure",
    icon: "🏦",
  },
  {
    value: "Startup",
    label: "Startup",
    description: "Early-stage scalable business",
    icon: "🚀",
  },
  {
    value: "SME",
    label: "SME",
    description: "Small or medium enterprise",
    icon: "🏪",
  },
  {
    value: "Non-profit",
    label: "Non-profit",
    description: "NGO, trust, foundation",
    icon: "🌱",
  },
  {
    value: "Other",
    label: "Other",
    description: "Any other legal structure",
    icon: "📌",
  },
];

const FINANCIAL_YEAR_OPTIONS: SelectOption[] = [
  {
    value: "2023-24",
    label: "2023-24",
    description: "April 2023 to March 2024",
    icon: "📅",
  },
  {
    value: "2024-25",
    label: "2024-25",
    description: "April 2024 to March 2025",
    icon: "📅",
  },
  {
    value: "2025-26",
    label: "2025-26",
    description: "April 2025 to March 2026",
    icon: "📅",
  },
  {
    value: "2026-27",
    label: "2026-27",
    description: "April 2026 to March 2027",
    icon: "📅",
  },
  {
    value: "Calendar Year 2024",
    label: "Calendar Year 2024",
    description: "January 2024 to December 2024",
    icon: "🗓️",
  },
  {
    value: "Calendar Year 2025",
    label: "Calendar Year 2025",
    description: "January 2025 to December 2025",
    icon: "🗓️",
  },
  {
    value: "Calendar Year 2026",
    label: "Calendar Year 2026",
    description: "January 2026 to December 2026",
    icon: "🗓️",
  },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  {
    value: "INR",
    label: "INR — Indian Rupee",
    description: "₹ Indian Rupee",
    icon: "₹",
  },
  {
    value: "USD",
    label: "USD — US Dollar",
    description: "$ United States Dollar",
    icon: "$",
  },
  {
    value: "EUR",
    label: "EUR — Euro",
    description: "€ Euro",
    icon: "€",
  },
  {
    value: "GBP",
    label: "GBP — British Pound",
    description: "£ Pound Sterling",
    icon: "£",
  },
  {
    value: "CHF",
    label: "CHF — Swiss Franc",
    description: "Swiss Franc",
    icon: "₣",
  },
  {
    value: "AED",
    label: "AED — UAE Dirham",
    description: "United Arab Emirates Dirham",
    icon: "د.إ",
  },
  {
    value: "SGD",
    label: "SGD — Singapore Dollar",
    description: "Singapore Dollar",
    icon: "S$",
  },
  {
    value: "AUD",
    label: "AUD — Australian Dollar",
    description: "Australian Dollar",
    icon: "A$",
  },
  {
    value: "CAD",
    label: "CAD — Canadian Dollar",
    description: "Canadian Dollar",
    icon: "C$",
  },
  {
    value: "JPY",
    label: "JPY — Japanese Yen",
    description: "Japanese Yen",
    icon: "¥",
  },
];

const COUNTRY_OPTIONS: SelectOption[] = [
  {
    value: "India",
    label: "India",
    description: "Business operating in India",
    icon: "🇮🇳",
  },
  {
    value: "United States",
    label: "United States",
    description: "Business operating in the US",
    icon: "🇺🇸",
  },
  {
    value: "United Kingdom",
    label: "United Kingdom",
    description: "Business operating in the UK",
    icon: "🇬🇧",
  },
  {
    value: "United Arab Emirates",
    label: "United Arab Emirates",
    description: "Business operating in UAE",
    icon: "🇦🇪",
  },
  {
    value: "Singapore",
    label: "Singapore",
    description: "Business operating in Singapore",
    icon: "🇸🇬",
  },
  {
    value: "Switzerland",
    label: "Switzerland",
    description: "Business operating in Switzerland",
    icon: "🇨🇭",
  },
  {
    value: "Germany",
    label: "Germany",
    description: "Business operating in Germany",
    icon: "🇩🇪",
  },
  {
    value: "France",
    label: "France",
    description: "Business operating in France",
    icon: "🇫🇷",
  },
  {
    value: "Canada",
    label: "Canada",
    description: "Business operating in Canada",
    icon: "🇨🇦",
  },
  {
    value: "Australia",
    label: "Australia",
    description: "Business operating in Australia",
    icon: "🇦🇺",
  },
  {
    value: "Japan",
    label: "Japan",
    description: "Business operating in Japan",
    icon: "🇯🇵",
  },
  {
    value: "Other",
    label: "Other",
    description: "Any other country",
    icon: "🌍",
  },
];

function findOption(options: SelectOption[], value: string) {
  return (
    options.find((option) => option.value === value) ?? {
      value,
      label: value || "Select option",
      description: "Choose the closest matching option",
      icon: "📌",
    }
  );
}

function InlineScrollableSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = findOption(options, value);

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <label
        style={{
          color: "var(--color-text-primary)",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          border: "1px solid rgba(245,158,11,0.24)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.060), rgba(255,255,255,0.025))",
          color: "var(--color-text-primary)",
          borderRadius: 18,
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.65 : 1,
          textAlign: "left",
          minWidth: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,209,102,0.28)",
              background: "rgba(245,158,11,0.10)",
              color: "var(--color-gold)",
              fontSize: 15,
              fontWeight: 950,
              flex: "0 0 auto",
            }}
          >
            {selected.icon ?? "📌"}
          </span>

          <span
            style={{
              display: "grid",
              gap: 4,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.25,
                overflowWrap: "anywhere",
              }}
            >
              {selected.label}
            </strong>

            {selected.description ? (
              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                }}
              >
                {selected.description}
              </span>
            ) : null}
          </span>
        </span>

        <span
          style={{
            color: "var(--color-gold)",
            fontSize: 16,
            lineHeight: 1,
            flex: "0 0 auto",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          style={{
            border: "1px solid rgba(245,158,11,0.22)",
            background:
              "linear-gradient(135deg, rgba(10,15,22,0.98), rgba(14,20,30,0.98))",
            borderRadius: 20,
            padding: 8,
            display: "grid",
            gap: 6,
            maxHeight: 360,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            boxShadow:
              "0 18px 52px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  border: active
                    ? "1px solid rgba(255,209,102,0.30)"
                    : "1px solid rgba(255,255,255,0.045)",
                  background: active
                    ? "rgba(245,158,11,0.10)"
                    : "rgba(255,255,255,0.024)",
                  color: "var(--color-text-primary)",
                  borderRadius: 15,
                  padding: 11,
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                  textAlign: "left",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255,209,102,0.24)",
                    background: "rgba(245,158,11,0.085)",
                    color: "var(--color-gold)",
                    fontSize: 13,
                    fontWeight: 950,
                    flex: "0 0 auto",
                  }}
                >
                  {option.icon ?? "📌"}
                </span>

                <span
                  style={{
                    display: "grid",
                    gap: 3,
                    minWidth: 0,
                  }}
                >
                  <strong
                    style={{
                      color: active
                        ? "var(--color-gold)"
                        : "var(--color-text-primary)",
                      fontSize: 13,
                      lineHeight: 1.2,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {option.label}
                  </strong>

                  {option.description ? (
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 11,
                        lineHeight: 1.35,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <label
        style={{
          color: "var(--color-text-primary)",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {label}
      </label>

      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          border: "1px solid rgba(245,158,11,0.20)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.024))",
          color: "var(--color-text-primary)",
          borderRadius: 18,
          padding: "15px 16px",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          opacity: disabled ? 0.65 : 1,
        }}
      />
    </div>
  );
}

export function BusinessProfileForm({
  business,
  initialBusiness,
  initialValues,
  hasBusinessProfile,
}: BusinessProfileFormProps) {
  const router = useRouter();
  const currentBusiness = business ?? initialBusiness ?? initialValues ?? null;
  const profileExists = hasBusinessProfile ?? Boolean(currentBusiness?.name);

  const [name, setName] = useState(currentBusiness?.name ?? "");
  const [industry, setIndustry] = useState(
    currentBusiness?.industry ?? "Technology",
  );
  const [businessType, setBusinessType] = useState(
    currentBusiness?.businessType ?? "Private Limited",
  );
  const [financialYear, setFinancialYear] = useState(
    currentBusiness?.financialYear ?? "2025-26",
  );
  const [currency, setCurrency] = useState(currentBusiness?.currency ?? "INR");
  const [country, setCountry] = useState(currentBusiness?.country ?? "India");
  const [state, setState] = useState<FormState>({
    type: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();

  const selectedSummary = useMemo(() => {
    return `${industry} · ${businessType} · ${currency} · ${country}`;
  }, [industry, businessType, currency, country]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setState({
        type: "error",
        message: "Please enter your business name.",
      });
      return;
    }

    setState({
      type: "idle",
      message: "",
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/business", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            industry,
            businessType,
            financialYear,
            currency,
            country,
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Business profile could not be saved.");
        }

        setState({
          type: "success",
          message:
            data?.message ??
            (profileExists
              ? "Business profile updated successfully."
              : "Business profile saved successfully."),
        });

        router.refresh();
      } catch (error) {
        setState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Business profile could not be saved.",
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid rgba(245,158,11,0.16)",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.10), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.024))",
        borderRadius: 28,
        padding: 22,
        display: "grid",
        gap: 20,
        minWidth: 0,
        overflow: "visible",
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
            minWidth: 0,
          }}
        >
          <p className="section-title" style={{ margin: 0 }}>
            Business profile
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            This context improves dashboard accuracy, AI answers, and CFO-style
            reports.
          </p>
        </div>

        <span
          style={{
            border: "1px solid rgba(255,209,102,0.26)",
            background: "rgba(245,158,11,0.09)",
            color: "var(--color-gold)",
            borderRadius: 999,
            padding: "8px 11px",
            fontSize: 11,
            fontWeight: 950,
            maxWidth: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {selectedSummary}
        </span>
      </div>

      <TextInput
        label="Business name"
        value={name}
        placeholder="Example: Aureli Foods Pvt Ltd"
        onChange={setName}
        disabled={isPending}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
        className="business-profile-grid"
      >
        <InlineScrollableSelect
          label="Industry"
          value={industry}
          options={INDUSTRY_OPTIONS}
          onChange={setIndustry}
          disabled={isPending}
        />

        <InlineScrollableSelect
          label="Business type"
          value={businessType}
          options={BUSINESS_TYPE_OPTIONS}
          onChange={setBusinessType}
          disabled={isPending}
        />

        <InlineScrollableSelect
          label="Financial year"
          value={financialYear}
          options={FINANCIAL_YEAR_OPTIONS}
          onChange={setFinancialYear}
          disabled={isPending}
        />

        <InlineScrollableSelect
          label="Currency"
          value={currency}
          options={CURRENCY_OPTIONS}
          onChange={setCurrency}
          disabled={isPending}
        />

        <InlineScrollableSelect
          label="Country"
          value={country}
          options={COUNTRY_OPTIONS}
          onChange={setCountry}
          disabled={isPending}
        />
      </div>

      {state.type !== "idle" ? (
        <div
          style={{
            border:
              state.type === "success"
                ? "1px solid rgba(46,213,115,0.28)"
                : "1px solid rgba(255,138,149,0.30)",
            background:
              state.type === "success"
                ? "rgba(46,213,115,0.085)"
                : "rgba(255,138,149,0.085)",
            color:
              state.type === "success"
                ? "var(--color-sage)"
                : "var(--color-danger)",
            borderRadius: 16,
            padding: 13,
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 750,
            overflowWrap: "anywhere",
          }}
        >
          {state.message}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          className="btn-ghost"
          style={{
            border: "1px solid rgba(255,209,102,0.30)",
            background: "rgba(245,158,11,0.10)",
            color: "var(--color-gold)",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending
            ? "Saving profile..."
            : profileExists
              ? "Update business profile"
              : "Save business profile"}
        </button>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          Approved documents plus this profile power Aureli&apos;s finance
          intelligence.
        </span>
      </div>

      <style>
        {`
          @media (max-width: 860px) {
            .business-profile-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </form>
  );
}