export function humanizeIdentifier(identifier: string): string {
  const source = identifier.trim();
  if (!source) {
    return "";
  }

  const hasLowercase = /[a-z]/.test(source);
  const words = source
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return words
    .split(" ")
    .map((word) => {
      if (hasLowercase && /^[A-Z0-9]+$/.test(word)) {
        return word;
      }
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function displayName(
  preferredName: string | null | undefined,
  identifier: string,
): string {
  return preferredName?.trim() || humanizeIdentifier(identifier);
}
