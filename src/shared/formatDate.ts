export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, options).format(date);
}
