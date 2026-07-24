import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format ISO date string for display */
export function formatDate(date: string): string {
  return format(new Date(date), 'MMM d, yyyy')
}

/** Format ISO date to relative time */
export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/** Get severity color class */
export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    low: 'badge-low',
    medium: 'badge-medium',
    high: 'badge-high',
    critical: 'badge-critical',
  }
  return map[severity] ?? 'badge-low'
}

/** Get status color class */
export function getStatusColor(status: string): string {
  return `badge-${status}` // uses CSS class from index.css
}

/** Capitalize first letter */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Convert snake_case to Title Case */
export function toTitleCase(s: string): string {
  return s.split('_').map(capitalize).join(' ')
}

/** Truncate text */
export function truncate(text: string, maxLen: number = 120): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

/** Get initials from full name */
export function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Build backend image URL */
export function getImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return `${base}${path}`
}
