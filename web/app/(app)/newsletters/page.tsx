import { FeedList } from "@/components/feed-list"
import { getNewsletterAddress } from "@/actions/publishing"
import { NewsletterAddress } from "./newsletter-address"

export default async function NewslettersPage() {
  const address = await getNewsletterAddress()

  return (
    <div>
      {address && <NewsletterAddress address={address} />}
      <FeedList
        feedType="newsletter"
        title="Newsletters"
        description="Forward newsletters to your Eclectis address to automatically extract and score articles."
        showOPML
        showScanAll={false}
      />
    </div>
  )
}
