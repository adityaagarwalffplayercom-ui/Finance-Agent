export type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

export type StatBlock = {
  value: string;
  delta: string;
};

// Placeholder data shown until Steps 3–4 (document upload + processing) are
// built and a real financial profile exists for the signed-in business.
export const dashboardData = {
  healthScore: 58,
  healthLabel: "Cash runway needs attention",

  revenue: { value: "$48,200", delta: "+6.4% vs last month" } satisfies StatBlock,
  expenses: { value: "$34,850", delta: "+11.2% vs last month" } satisfies StatBlock,
  profit: { value: "$13,350", delta: "-3.1% vs last month" } satisfies StatBlock,
  cash: { value: "$21,400", delta: "18-day runway" } satisfies StatBlock,

  cashFlowTrend: [18400, 21100, 19800, 24300, 22600, 21400],

  alerts: [
    {
      id: "1",
      severity: "critical",
      message: "Cash may run out in 18 days at the current burn rate.",
    },
    {
      id: "2",
      severity: "warning",
      message: "Electricity costs increased 32% compared to last month.",
    },
    {
      id: "3",
      severity: "warning",
      message: "Vendor ABC Supplies appears to be charging more than usual.",
    },
    {
      id: "4",
      severity: "info",
      message: "One invoice from last week may be a duplicate — worth a check.",
    },
    {
      id: "5",
      severity: "info",
      message: "Revenue is growing, but profit margin is slipping month over month.",
    },
  ] satisfies Alert[],
};
