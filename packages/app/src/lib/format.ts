export function formatBytes(value: number) {
  if (value === 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  )
  const normalized = value / 1024 ** exponent

  return `${normalized.toFixed(normalized >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatRelativeTime(value: string) {
  const now = Date.now()
  const target = new Date(value).getTime()
  const deltaSeconds = Math.round((target - now) / 1000)
  const absSeconds = Math.abs(deltaSeconds)
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (absSeconds < 60) {
    return formatter.format(deltaSeconds, "second")
  }

  const deltaMinutes = Math.round(deltaSeconds / 60)
  const absMinutes = Math.abs(deltaMinutes)
  if (absMinutes < 60) {
    return formatter.format(deltaMinutes, "minute")
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  const absHours = Math.abs(deltaHours)
  if (absHours < 24) {
    return formatter.format(deltaHours, "hour")
  }

  const deltaDays = Math.round(deltaHours / 24)
  return formatter.format(deltaDays, "day")
}

export function truncateMiddle(value: string, maxLength = 34) {
  if (value.length <= maxLength) {
    return value
  }

  const lead = Math.ceil((maxLength - 1) / 2)
  const tail = Math.floor((maxLength - 1) / 2)

  return `${value.slice(0, lead)}…${value.slice(-tail)}`
}
