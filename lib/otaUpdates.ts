import * as Updates from 'expo-updates';

const CHECK_TIMEOUT_MS = 4000;
const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))]);
}

// Runs behind the splash on cold start. If a newer update exists it is
// downloaded and applied immediately via reloadAsync(), so users never see a
// stale bundle on first open. Resolves `true` when a reload was triggered
// (caller should keep the splash up); `false` to continue normally. Never
// throws and never blocks longer than the timeouts above — on a slow network
// the download continues in the background and applies on the next launch.
export async function applyPendingUpdateOnLaunch(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
    if (check === 'timeout' || !check.isAvailable) return false;

    const fetched = await withTimeout(Updates.fetchUpdateAsync(), FETCH_TIMEOUT_MS);
    if (fetched === 'timeout' || !fetched.isNew) return false;

    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
