export interface YouTubeMetadata {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null
      }
      return u.searchParams.get('v')
    }
    return null
  } catch {
    return null
  }
}

export function matchesUrl(url: string): boolean {
  return extractVideoId(url) !== null
}

export function buildThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  const videoId = extractVideoId(url)
  if (!videoId) return null

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl)
    if (!res.ok) return null
    const data = await res.json() as { title?: string; author_name?: string }
    return {
      videoId,
      title: data.title ?? 'YouTube Video',
      thumbnail: buildThumbnailUrl(videoId),
      channelName: data.author_name ?? '',
    }
  } catch {
    return {
      videoId,
      title: 'YouTube Video',
      thumbnail: buildThumbnailUrl(videoId),
      channelName: '',
    }
  }
}
