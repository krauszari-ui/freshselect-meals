/** Match a full @Name token without treating a shorter name as a prefix. */
export function containsExactMention(content: string, name: string): boolean {
  const normalizedName = name.trim();
  if (!normalizedName) return false;
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${escapedName}(?=$|[\\s.,!?;:()\\[\\]{}])`, "i").test(content);
}
