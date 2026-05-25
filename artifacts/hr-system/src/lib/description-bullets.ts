/** Split HR job description into poster bullet lines (one line = one bullet). */
export function descriptionToBullets(description: string): string[] {
  return description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•*]\s*/, ""));
}
