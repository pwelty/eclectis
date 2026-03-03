import type { Metadata } from "next"
import Link from "next/link"
import {
  Rss,
  Mail,
  Mic,
  Search,
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  BookOpen,
  Eye,
  Unplug,
  X,
} from "lucide-react"
import { ScrollReveal } from "@/components/scroll-reveal"

export const metadata: Metadata = {
  title: "Eclectis \u2014 AI content curation for what matters",
  description:
    "Eclectis is an AI intelligence layer for personal content curation. Discover, score, and deliver curated articles, podcasts, and newsletters to your existing RSS reader, email, or read-later app.",
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Hero />
      <LogoBar />
      <HowItWorks />
      <Outputs />
      <WhyEclectis />
      <Pricing />
      <Faq />
      <Cta />
      <LandingFooter />
    </div>
  )
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-brand-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          eclectis
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-brand-300 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-brand-950 transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-950 dot-grid">
      {/* Ambient glow */}
      <div className="amber-glow pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[600px] rounded-full bg-amber-500/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-24 sm:pb-36 sm:pt-32 lg:pb-44 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="hero-animate hero-animate-delay-1 mb-6 font-mono text-xs font-medium uppercase tracking-[0.25em] text-amber-400">
            Intelligence layer for content
          </p>

          <h1 className="hero-animate hero-animate-delay-2 text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Only see what
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              actually matters
            </span>
          </h1>

          <p className="hero-animate hero-animate-delay-3 mx-auto mt-8 max-w-xl text-lg leading-relaxed text-brand-300 sm:text-xl">
            You pick the sources. You pick where it shows up.
            We make sure you only see what&apos;s worth your time.
          </p>

          <div className="hero-animate hero-animate-delay-4 mt-12 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="group inline-flex h-13 items-center gap-3 rounded-xl bg-amber-500 px-7 text-base font-semibold text-brand-950 transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/25"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="text-sm text-brand-400">
              Free with your API key &middot; No credit card
            </span>
          </div>
        </div>
      </div>

      {/* Bottom edge fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}

/* ─── Trust bar ───────────────────────────────────────────────────────────── */

function LogoBar() {
  return (
    <section className="border-b border-border bg-background py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-text-tertiary">
          Delivers to tools you already use
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm font-medium text-text-secondary">
          <span className="flex items-center gap-2"><Rss className="size-4 text-amber-500" /> Feedbin</span>
          <span className="flex items-center gap-2"><Rss className="size-4 text-amber-500" /> Reeder</span>
          <span className="flex items-center gap-2"><Mail className="size-4 text-amber-500" /> Email</span>
          <span className="flex items-center gap-2"><BookOpen className="size-4 text-amber-500" /> Readwise</span>
          <span className="flex items-center gap-2"><Rss className="size-4 text-amber-500" /> Any RSS reader</span>
        </div>
      </div>
    </section>
  )
}

/* ─── How it works ────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Sparkles,
      title: "Tell us what you care about",
      description:
        "Describe your interests in plain language. Add RSS feeds, set up search terms, forward newsletters. Eclectis builds a profile of what matters to you.",
    },
    {
      num: "02",
      icon: Search,
      title: "We discover and score",
      description:
        "AI continuously scans your sources, discovers new content, and scores every article 0\u201310 for relevance to your interests. Noise gets filtered before you see it.",
    },
    {
      num: "03",
      icon: Zap,
      title: "Delivered to your tools",
      description:
        "Curated results arrive in your RSS reader, email inbox, or podcast player. No new app to learn. Your workflow stays exactly the same \u2014 just smarter.",
    },
  ]

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Three steps from noise to signal
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-8">
          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 120}>
              <div className="relative">
                <span className="font-mono text-6xl font-bold leading-none text-amber-500/15">
                  {step.num}
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-100">
                    <step.icon className="size-5 text-brand-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Output surfaces ─────────────────────────────────────────────────────── */

function Outputs() {
  const outputs = [
    {
      icon: Rss,
      title: "RSS feed",
      description: "Subscribe in Feedbin, Reeder, or any reader you already use.",
      available: true,
    },
    {
      icon: Mail,
      title: "Email briefing",
      description: "Daily digest with your top picks, themes, and AI summaries.",
      available: true,
    },
    {
      icon: Mic,
      title: "Podcast feed",
      description: "Articles read aloud with text-to-speech. Listen on your commute.",
      available: false,
    },
    {
      icon: BookOpen,
      title: "Read-later push",
      description: "Auto-send top picks to Raindrop, Readwise, or Pocket.",
      available: false,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-brand-950 dot-grid py-24 sm:py-32">
      {/* Subtle amber glow */}
      <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] -translate-y-1/2 translate-x-1/3 rounded-full bg-amber-500/8 blur-[100px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
            Outputs
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your content, your way
          </h2>
          <p className="mt-3 max-w-lg text-brand-300">
            The product is the curation, not the container. We deliver to wherever you already consume.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {outputs.map((output, i) => (
            <ScrollReveal key={output.title} delay={i * 80}>
              <div className="group rounded-xl border border-brand-700/50 bg-brand-900/60 p-6 transition-all hover:border-amber-500/30 hover:bg-brand-800/50">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-800 transition-colors group-hover:bg-amber-500/10">
                    <output.icon className="size-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{output.title}</h3>
                      {!output.available && (
                        <span className="rounded-full border border-brand-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand-400">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-brand-300">
                      {output.description}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Why Eclectis ────────────────────────────────────────────────────────── */

function WhyEclectis() {
  const points = [
    {
      icon: X,
      title: "Not another reader",
      description:
        "Every RSS reader promises to tame the firehose. Then they become the firehose. Eclectis doesn\u2019t show you everything \u2014 it shows you what scores highest for your interests.",
    },
    {
      icon: Unplug,
      title: "Output, not lock-in",
      description:
        "We deliver to your existing tools. If you cancel, your RSS reader and email still work. Standard formats in, standard formats out.",
    },
    {
      icon: Eye,
      title: "AI that shows its work",
      description:
        "Every score has a reason. Every recommendation is auditable. No black-box algorithms \u2014 you see exactly why content was surfaced or filtered.",
    },
  ]

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
            Why Eclectis
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built because we kept drowning
            <br className="hidden sm:block" />
            in our own feeds
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {points.map((point, i) => (
            <ScrollReveal key={point.title} delay={i * 120}>
              <div className="flex size-11 items-center justify-center rounded-lg bg-amber-100">
                <point.icon className="size-5 text-amber-700" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="mt-2 leading-relaxed text-text-secondary">
                {point.description}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ─────────────────────────────────────────────────────────────── */

function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Bring your own Anthropic API key",
      features: [
        "AI-scored content curation",
        "Up to 10 RSS feeds",
        "3 search terms",
        "Curated RSS feed output",
        "You control your API costs",
      ],
      cta: "Start free",
      href: "/signup",
      featured: false,
    },
    {
      name: "Pro",
      price: "$8",
      period: "/mo",
      description: "We cover all AI costs",
      features: [
        "Everything in Free",
        "Unlimited feeds and search terms",
        "Daily email briefings",
        "Podcast feed (coming soon)",
        "Read-later integrations",
        "Priority support",
      ],
      cta: "Start free trial",
      href: "/signup",
      featured: true,
    },
  ]

  return (
    <section className="border-y border-border bg-surface-secondary py-24 sm:py-32" id="pricing">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-text-secondary">
              Start free. Upgrade when you want us to handle the AI costs.
            </p>
          </div>
        </ScrollReveal>

        <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 100}>
              <div
                className={`relative rounded-2xl p-8 transition-shadow ${
                  plan.featured
                    ? "border-2 border-amber-400 bg-card shadow-xl shadow-amber-500/5"
                    : "border border-border bg-card"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-amber-500 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-950">
                    Popular
                  </span>
                )}

                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="mt-0.5 text-sm text-text-secondary">{plan.description}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-text-tertiary">{plan.period}</span>
                </div>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-score-high" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                    plan.featured
                      ? "bg-amber-500 text-brand-950 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */

function Faq() {
  const faqs = [
    {
      q: "What does \u2018bring your own API key\u2019 mean?",
      a: "On the free plan, you provide your own Anthropic API key. You pay Anthropic directly for AI usage \u2014 typically a few cents per day. On Pro, we cover all AI costs.",
    },
    {
      q: "Do I need to install a new app?",
      a: "No. Eclectis delivers to tools you already use \u2014 your RSS reader, email inbox, or podcast player. The web dashboard is just for managing sources and preferences.",
    },
    {
      q: "What sources are supported?",
      a: "RSS feeds, Google search results, and email newsletters. We\u2019re adding podcast index and more sources over time.",
    },
    {
      q: "How does scoring work?",
      a: "AI reads each article and scores it 0\u201310 based on your interests. You can vote on articles to improve future scores. Every score includes an explanation.",
    },
    {
      q: "Can I export my data?",
      a: "Yes. Feeds export as OPML, curated content is available as RSS, and you can download everything at any time. No lock-in, ever.",
    },
    {
      q: "What happens if I cancel Pro?",
      a: "You keep the free plan with your own API key. Your feeds, search terms, and curated content stay intact. Only Pro features (email briefings, unlimited feeds) are disabled.",
    },
  ]

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions
          </h2>
        </ScrollReveal>

        <div className="mt-12 divide-y divide-border">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.q} delay={i * 60}>
              <div className="py-7">
                <h3 className="text-base font-semibold text-foreground">{faq.q}</h3>
                <p className="mt-2.5 leading-relaxed text-text-secondary">{faq.a}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Bottom CTA ──────────────────────────────────────────────────────────── */

function Cta() {
  return (
    <section className="relative overflow-hidden bg-brand-950 dot-grid py-24 sm:py-32">
      <div className="amber-glow pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Stop reading everything.
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
              Start reading what matters.
            </span>
          </p>
          <p className="mt-6 text-lg text-brand-300">
            Set up in 5 minutes. Free with your own API key.
          </p>
          <Link
            href="/signup"
            className="group mt-10 inline-flex h-13 items-center gap-3 rounded-xl bg-amber-500 px-7 text-base font-semibold text-brand-950 transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/25"
          >
            Get started
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

function LandingFooter() {
  return (
    <footer className="border-t border-brand-800 bg-brand-950 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-tight text-white">eclectis</span>
          <span className="font-mono text-xs text-brand-500">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
        <div className="flex gap-8 text-sm text-brand-400">
          <a href="mailto:support@eclectis.io" className="transition-colors hover:text-white">
            Support
          </a>
          <Link href="/login" className="transition-colors hover:text-white">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  )
}
