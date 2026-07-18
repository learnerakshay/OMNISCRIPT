/**
 * Formats a date or date string into a concise human-readable last active format.
 * Examples: Just now, 2 minutes ago, 1 hour ago, Yesterday, 3 days ago.
 */
export function formatLastActive(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "Unknown";
  
  const date = typeof dateInput === "string" || typeof dateInput === "number" 
    ? new Date(dateInput) 
    : dateInput;

  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 15) {
    return "Just now";
  }
  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Fallback to standard short date
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
