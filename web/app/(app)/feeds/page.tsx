import { FeedList } from "@/components/feed-list"

export default function RSSFeedsPage() {
  return (
    <FeedList
      feedType="rss"
      title="RSS feeds"
      description="Manage your RSS feed subscriptions."
      showOPML
    />
  )
}
