import { FeedList } from "@/components/feed-list"

export default function NewslettersPage() {
  return (
    <FeedList
      feedType="newsletter"
      title="Newsletters"
      description="Manage your newsletter sources. You can also forward newsletters to your Eclectis address."
      showScanAll={false}
    />
  )
}
