import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Local calendar date as YYYY-MM-DD (avoids UTC drift from toISOString). */
export function toLocalDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isSameLocalDay(
  date: Date | string,
  reference: Date = new Date()
): boolean {
  return toLocalDateString(date) === toLocalDateString(reference)
}

export function isSameLocalMonth(
  date: Date | string,
  reference: Date = new Date()
): boolean {
  const d = typeof date === "string" ? new Date(date) : date
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth()
  )
}
