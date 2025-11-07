export function serializeForLog(value: unknown) {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (!json) return json;
    return json.length > 500 ? `${json.slice(0, 497)}...` : json;
  } catch {
    return String(value);
  }
}

export function isErrorResponse(
  value: unknown,
): value is { error: { code: string; message: string } } {
  if (!value || typeof value !== "object") return false;
  const maybeError = (value as { error?: unknown }).error;
  if (!maybeError || typeof maybeError !== "object") return false;
  const { code, message } = maybeError as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string";
}
