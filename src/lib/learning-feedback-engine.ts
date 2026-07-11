export type LearningRewardType =
  | "HELPFUL"
  | "NOT_HELPFUL"
  | "ACCEPTED"
  | "COMPLETED";

export type LearningCategory =
  | "CASH_FLOW"
  | "PROFIT"
  | "RISK"
  | "DOCUMENTS"
  | "TAX"
  | "ANOMALY"
  | "GROWTH"
  | "UNKNOWN";

export type LearningFeedbackEvent = {
  id: string;
  actionId: string;
  actionTitle: string;
  category: LearningCategory;
  rewardType: LearningRewardType;
  rewardValue: number;
  createdAt: string;
};

export type LearningActionInput = {
  id: string;
  title: string;
  category: LearningCategory | string;
  priority?: string;
  confidence?: string;
  timeframe?: string;
};

export type LearningOptimizedAction = LearningActionInput & {
  originalRank: number;
  optimizedScore: number;
  rewardScore: number;
  learningLabel: string;
};

export type LearningSummary = {
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  acceptedCount: number;
  completedCount: number;
  learningScore: number;
  bestCategory: LearningCategory;
  weakestCategory: LearningCategory;
  categoryRewards: Record<LearningCategory, number>;
};

const CATEGORIES: LearningCategory[] = [
  "CASH_FLOW",
  "PROFIT",
  "RISK",
  "DOCUMENTS",
  "TAX",
  "ANOMALY",
  "GROWTH",
  "UNKNOWN",
];

export function rewardValueForType(type: LearningRewardType) {
  if (type === "COMPLETED") return 5;
  if (type === "ACCEPTED") return 3;
  if (type === "HELPFUL") return 2;
  return -2;
}

export function normalizeLearningCategory(value: unknown): LearningCategory {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "CASH_FLOW") return "CASH_FLOW";
  if (raw === "PROFIT") return "PROFIT";
  if (raw === "RISK") return "RISK";
  if (raw === "DOCUMENTS") return "DOCUMENTS";
  if (raw === "TAX") return "TAX";
  if (raw === "ANOMALY") return "ANOMALY";
  if (raw === "GROWTH") return "GROWTH";

  return "UNKNOWN";
}

function priorityScore(priority?: string) {
  const clean = String(priority ?? "").toUpperCase();

  if (clean === "CRITICAL") return 40;
  if (clean === "HIGH") return 30;
  if (clean === "MEDIUM") return 20;
  if (clean === "LOW") return 10;

  return 12;
}

function confidenceScore(confidence?: string) {
  const clean = String(confidence ?? "").toUpperCase();

  if (clean === "HIGH") return 12;
  if (clean === "MEDIUM") return 8;
  if (clean === "LOW") return 4;

  return 5;
}

function timeframeScore(timeframe?: string) {
  const clean = String(timeframe ?? "").toUpperCase();

  if (clean === "TODAY") return 15;
  if (clean === "THIS_WEEK") return 10;
  if (clean === "THIS_MONTH") return 5;

  return 4;
}

export function buildLearningFeedbackEvent({
  actionId,
  actionTitle,
  category,
  rewardType,
}: {
  actionId: string;
  actionTitle: string;
  category: LearningCategory | string;
  rewardType: LearningRewardType;
}): LearningFeedbackEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    actionId,
    actionTitle,
    category: normalizeLearningCategory(category),
    rewardType,
    rewardValue: rewardValueForType(rewardType),
    createdAt: new Date().toISOString(),
  };
}

export function summarizeLearningFeedback(
  feedback: LearningFeedbackEvent[],
): LearningSummary {
  const categoryRewards = CATEGORIES.reduce(
    (accumulator, category) => ({
      ...accumulator,
      [category]: 0,
    }),
    {} as Record<LearningCategory, number>,
  );

  let helpfulCount = 0;
  let notHelpfulCount = 0;
  let acceptedCount = 0;
  let completedCount = 0;

  for (const event of feedback) {
    categoryRewards[event.category] += event.rewardValue;

    if (event.rewardType === "HELPFUL") helpfulCount += 1;
    if (event.rewardType === "NOT_HELPFUL") notHelpfulCount += 1;
    if (event.rewardType === "ACCEPTED") acceptedCount += 1;
    if (event.rewardType === "COMPLETED") completedCount += 1;
  }

  const rankedCategories = CATEGORIES.map((category) => ({
    category,
    score: categoryRewards[category],
  })).sort((a, b) => b.score - a.score);

  const positiveReward = feedback
    .filter((event) => event.rewardValue > 0)
    .reduce((total, event) => total + event.rewardValue, 0);

  const negativeReward = Math.abs(
    feedback
      .filter((event) => event.rewardValue < 0)
      .reduce((total, event) => total + event.rewardValue, 0),
  );

  const learningScore =
    feedback.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((positiveReward / Math.max(1, positiveReward + negativeReward)) * 100),
          ),
        );

  return {
    totalFeedback: feedback.length,
    helpfulCount,
    notHelpfulCount,
    acceptedCount,
    completedCount,
    learningScore,
    bestCategory: rankedCategories[0]?.category ?? "UNKNOWN",
    weakestCategory: rankedCategories[rankedCategories.length - 1]?.category ?? "UNKNOWN",
    categoryRewards,
  };
}

export function optimizeActionsWithLearning({
  actions,
  feedback,
}: {
  actions: LearningActionInput[];
  feedback: LearningFeedbackEvent[];
}): LearningOptimizedAction[] {
  const summary = summarizeLearningFeedback(feedback);

  return actions
    .map((action, index) => {
      const category = normalizeLearningCategory(action.category);
      const rewardScore = summary.categoryRewards[category] ?? 0;
      const directActionReward = feedback
        .filter((event) => event.actionId === action.id)
        .reduce((total, event) => total + event.rewardValue, 0);

      const optimizedScore =
        priorityScore(action.priority) +
        confidenceScore(action.confidence) +
        timeframeScore(action.timeframe) +
        rewardScore * 3 +
        directActionReward * 5 -
        index;

      const learningLabel =
        directActionReward > 0
          ? "Previously rewarded by user"
          : rewardScore > 0
            ? "Category is learning positive"
            : rewardScore < 0
              ? "Category needs caution"
              : "No learning signal yet";

      return {
        ...action,
        category,
        originalRank: index + 1,
        optimizedScore,
        rewardScore: rewardScore + directActionReward,
        learningLabel,
      };
    })
    .sort((a, b) => b.optimizedScore - a.optimizedScore);
}