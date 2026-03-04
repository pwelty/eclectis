import { FeedList } from "@/components/feed-list"

export default function PodcastsPage() {
  return (
    <FeedList
      feedType="podcast"
      title="Podcasts"
      description="Manage your podcast feed subscriptions."
    />
  )
}
