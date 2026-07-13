import { WorkspacePlan } from "@prisma/client";

export type PlanLimits = {
  uploadsPerDay: number;
  aiProcessesPerHour: number;
  aiProcessesPerDay: number;
  storageBytes: number;
  maxFileBytes: number;
  members: number;
};

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  FREE: {
    uploadsPerDay: 10,
    aiProcessesPerHour: 5,
    aiProcessesPerDay: 15,
    storageBytes: 500 * 1024 * 1024,
    maxFileBytes: 25 * 1024 * 1024,
    members: 1,
  },
  STARTER: {
    uploadsPerDay: 50,
    aiProcessesPerHour: 15,
    aiProcessesPerDay: 100,
    storageBytes: 10 * 1024 * 1024 * 1024,
    maxFileBytes: 50 * 1024 * 1024,
    members: 5,
  },
  BUSINESS: {
    uploadsPerDay: 250,
    aiProcessesPerHour: 50,
    aiProcessesPerDay: 500,
    storageBytes: 100 * 1024 * 1024 * 1024,
    maxFileBytes: 100 * 1024 * 1024,
    members: 25,
  },
  ENTERPRISE: {
    uploadsPerDay: 2000,
    aiProcessesPerHour: 250,
    aiProcessesPerDay: 5000,
    storageBytes: 1024 * 1024 * 1024 * 1024,
    maxFileBytes: 250 * 1024 * 1024,
    members: 500,
  },
};

export function limitsForPlan(plan: WorkspacePlan) {
  return PLAN_LIMITS[plan];
}
