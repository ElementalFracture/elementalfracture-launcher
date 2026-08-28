/**
 * Resolve no sooner than `ms`, so work that finishes instantly still shows the
 * pending state it started.
 */
export async function atLeast<T>(work: Promise<T>, ms = 1000): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
  return result;
}
