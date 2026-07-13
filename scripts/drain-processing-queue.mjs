const appUrl = (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
const secret = process.env.JOB_WORKER_SECRET ?? process.env.CRON_SECRET;
const maxRounds = Math.max(1, Math.min(100, Number(process.env.QUEUE_DRAIN_MAX_ROUNDS ?? 25)));
if (!appUrl) throw new Error("APP_URL or BETTER_AUTH_URL is required.");
if (!secret) throw new Error("JOB_WORKER_SECRET or CRON_SECRET is required.");

for (let round = 1; round <= maxRounds; round += 1) {
  const response = await fetch(`${appUrl}/api/cron/process-jobs`, {
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `Queue endpoint returned HTTP ${response.status}.`);
  console.log(JSON.stringify({ round, ...payload }, null, 2));
  if (!Array.isArray(payload?.processed) || payload.processed.length === 0) break;
}
