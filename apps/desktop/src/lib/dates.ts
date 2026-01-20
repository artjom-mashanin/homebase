/**
 * Format a date string to a relative date like "Today", "Yesterday", "Monday", "Jan 19"
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  // Reset time part for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - inputDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Same year - don't show year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Different year - show full date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a date string to a full datetime like "Jan 19, 2026, 2:30 PM"
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a date string to a relative datetime like "Today at 2:30 PM"
 */
export function formatRelativeDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  // Reset time part for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - inputDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;

  // Same year - don't show year
  if (date.getFullYear() === now.getFullYear()) {
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  }

  // Different year - show full date
  return formatDateTime(isoString);
}

/**
 * Extract a snippet from markdown content (first N characters, stripped of markdown)
 */
export function extractSnippet(content: string, maxLength: number = 80): string {
  // Remove frontmatter
  let text = content.replace(/^---[\s\S]*?---\n?/, '');

  // Remove markdown headers
  text = text.replace(/^#+\s+/gm, '');

  // Remove markdown formatting
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/~~(.+?)~~/g, '$1')       // strikethrough
    .replace(/`(.+?)`/g, '$1')         // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/!\[.*?\]\(.+?\)/g, '')   // images
    .replace(/^[-*+]\s+/gm, '')        // list items
    .replace(/^\d+\.\s+/gm, '')        // numbered lists
    .replace(/^>\s+/gm, '')            // blockquotes
    .replace(/\n+/g, ' ')              // newlines to spaces
    .trim();

  if (text.length <= maxLength) return text;

  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}
