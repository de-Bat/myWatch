import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
import { YouTubeCard } from './YouTubeCard'
import { AddYouTubeItemModal } from './AddYouTubeItemModal'
import { matchesUrl, fetchYouTubeMetadata } from './utils'

const youtubePlugin: MyWatchPlugin = {
  id: 'youtube',
  displayName: 'YouTube Links',
  listTypes: [
    {
      id: 'youtube',
      label: 'YouTube Links',
      CardComponent: YouTubeCard,
      AddItemModal: AddYouTubeItemModal,
      matchesUrl,
      prefillFromUrl: async (url) => {
        const meta = await fetchYouTubeMetadata(url)
        if (!meta) return {}
        return {
          url,
          videoId: meta.videoId,
          title: meta.title,
          thumbnail: meta.thumbnail,
          channelName: meta.channelName,
          watched: false,
        }
      },
    },
  ],
}

export default youtubePlugin
