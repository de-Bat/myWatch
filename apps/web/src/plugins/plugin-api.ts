export function pluginApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''
  return `${baseUrl}${normalizedPath}`
}
