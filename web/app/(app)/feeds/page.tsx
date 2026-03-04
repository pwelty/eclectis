import { FeedList } from "@/components/feed-list"

export default function RSSFeedsPage() {
  return (
    <FeedList
      feedType="rss"
      title="RSS feeds"
      description="Add feeds manually or import from Inoreader (export OPML from Preferences > Import/Export)."
      showOPML
    />
  )
}
