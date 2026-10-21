import { Mail, ShoppingBasket, Tractor } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { InquiryForm } from '@/components/forms/InquiryForm';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageMeta } from '@/lib/seo';

function Article({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="page-container py-14">
      <article className="mx-auto max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{title}</h1>
        {intro ? <p className="mt-5 text-lg leading-8 text-charcoal-600">{intro}</p> : null}
        <div className="prose-farm mt-6">{children}</div>
      </article>
    </div>
  );
}

export function AboutPage() {
  return (
    <Article
      eyebrow="How it works"
      title="A shorter road from farm to home"
      intro="Farm2Home is a marketplace where Indian growers sell directly to the people who eat their produce. Farms set their own prices and handle their own orders; we provide the shop, the checks and the support."
    >
      <PageMeta title="How Farm2Home works" description="How Farm2Home verifies farms, splits orders between growers and gets produce to your door." />
      <h2>Verified before they sell</h2>
      <p>
        Every producer registers with their farm address and any registration details they hold. Our team reviews each application before the
        farm can publish listings, and we can remove listings or suspend sellers who don&apos;t meet our standards.
      </p>
      <h2>One basket, several farms</h2>
      <p>
        You can buy avocados from Wayanad and honey from the Nilgiris in the same order. Behind the scenes, each farm receives only its own
        part, confirms it and ships it. You can follow every part separately in your account.
      </p>
      <h2>Fair, simple pricing</h2>
      <ul>
        <li>The price you see is the price the farm set.</li>
        <li>Delivery is free when a farm&apos;s part of your order is ₹500 or more; otherwise it is ₹49 for that farm.</li>
        <li>Pay with cash on delivery. Online payments will be added once a payment partner is connected.</li>
      </ul>
      <h2>Talk to the grower</h2>
      <p>
        Have a question about harvest dates or bulk orders? Message the farm from any product page. Some farms also share a WhatsApp number.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink to="/products">Start shopping</ButtonLink>
        <ButtonLink to="/producer/register" variant="secondary">
          Sell your produce
        </ButtonLink>
      </div>
    </Article>
  );
}

const FAQS = [
  {
    q: 'Who are the sellers?',
    a: 'Independent farms, estates and beekeeping collectives. Each one is verified by our team before it can publish listings.',
  },
  {
    q: 'Why is my order split into parts?',
    a: 'Each farm packs and ships its own produce. Your order page shows a separate status for every farm, and you only pay delivery once per farm.',
  },
  {
    q: 'How do I pay?',
    a: 'Cash on delivery is available on every order. You pay each farm’s delivery partner when your items arrive.',
  },
  {
    q: 'Can I cancel an order?',
    a: 'Yes, until a farm starts preparing your items. Open the order in your account and choose “Cancel order”. Parts that are already being prepared or shipped can’t be cancelled.',
  },
  {
    q: 'What if a farm can’t fulfil my order?',
    a: 'The farm can decline its part with a reason. You will get an email, the items are released back to stock and you are not charged for them.',
  },
  {
    q: 'How do I leave a review?',
    a: 'Once a farm marks your items as delivered, you can review those products from your order page.',
  },
  {
    q: 'I grow produce. How do I start selling?',
    a: 'Register as a producer with your farm details. After you verify your email, our team reviews your farm, usually within two working days. You can prepare draft listings while you wait.',
  },
];

export function FaqPage() {
  return (
    <Article eyebrow="Help" title="Questions, answered">
      <PageMeta
        title="Help & FAQ"
        description="Answers about ordering, delivery, payments, cancellations and selling on Farm2Home."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
        }}
      />
      <div className="mt-2 divide-y divide-charcoal-800/[0.08] border-y border-charcoal-800/[0.08]">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-charcoal-900">
              {item.q}
              <span className="text-xl text-forest-600 transition group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="!mt-3">{item.a}</p>
          </details>
        ))}
      </div>
      <p>
        Still stuck? <Link to="/contact" className="font-medium text-forest-700 underline">Contact our team</Link>.
      </p>
    </Article>
  );
}

export function ContactPage() {
  return (
    <div className="page-container py-14">
      <PageMeta title="Contact us" description="Get in touch with the Farm2Home team about orders, partnerships or selling on the marketplace." />
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">We&apos;d love to hear from you</h1>
          <p className="mt-5 leading-7 text-charcoal-600">
            Questions about an order, partnerships or selling on Farm2Home? Send us a note and our team will reply by email. For questions about a
            specific product, message the farm directly from the product page.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-charcoal-600">
            <Mail className="h-4 w-4 text-forest-600" aria-hidden="true" /> We reply within two working days.
          </div>
        </div>
        <Card className="p-6 sm:p-8">
          <InquiryForm submitLabel="Send to the Farm2Home team" />
        </Card>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Article eyebrow="Legal" title="Privacy policy" intro="This summary explains what we collect, why, and who can see it.">
      <PageMeta title="Privacy policy" />
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address, phone number and password (stored only as a secure hash).</li>
        <li>Delivery addresses you save or enter at checkout.</li>
        <li>Orders, messages you send to farms or to us, and reviews you write.</li>
        <li>Aggregate product page view counts. We do not track individual browsing.</li>
      </ul>
      <h2>Who sees your information</h2>
      <p>
        When you order, each farm sees only its own items plus the delivery name, phone number and address needed to deliver them. Farms do not
        see your email address unless you message them. Reviews show your first name only. Farm contact numbers are shown only when a farm
        chooses to publish them.
      </p>
      <h2>Your choices</h2>
      <p>You can update your details from your account at any time. To close your account or request a copy of your data, contact us.</p>
      <p className="text-sm">This policy is a plain-language template and should be reviewed by a legal adviser before launch.</p>
    </Article>
  );
}

export function TermsPage() {
  return (
    <Article eyebrow="Legal" title="Terms of use">
      <PageMeta title="Terms of use" />
      <h2>The marketplace</h2>
      <p>
        Farm2Home lets verified producers list and sell their products to consumers. Each sale is between you and the farm; Farm2Home operates the
        platform, verifies sellers and helps resolve problems.
      </p>
      <h2>Orders and cancellations</h2>
      <p>
        Prices and stock are confirmed when you place an order. You may cancel any part of an order until the farm starts preparing it. Farms may
        decline an order with a reason, in which case you will not be charged for those items.
      </p>
      <h2>Producer responsibilities</h2>
      <p>Producers must describe products accurately, keep stock up to date, and fulfil accepted orders promptly. Listings that break these rules may be removed.</p>
      <p className="text-sm">These terms are a plain-language template and should be reviewed by a legal adviser before launch.</p>
    </Article>
  );
}

export function SignInChooserPage() {
  return (
    <div className="page-container py-16">
      <PageMeta title="Sign in" />
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl">Welcome to Farm2Home</h1>
        <p className="mt-3 text-charcoal-600">Choose how you use Farm2Home.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-8">
          <ShoppingBasket className="h-7 w-7 text-terracotta-600" aria-hidden="true" />
          <h2 className="mt-4 text-2xl">I&apos;m shopping</h2>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">Order from verified farms, track deliveries and save your favourites.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            <ButtonLink to="/consumer/login">Sign in</ButtonLink>
            <ButtonLink to="/consumer/register" variant="secondary">
              Create account
            </ButtonLink>
          </div>
        </Card>
        <Card className="flex flex-col bg-forest-900 p-8 text-sage-200">
          <Tractor className="h-7 w-7 text-sage-300" aria-hidden="true" />
          <h2 className="mt-4 text-2xl text-ivory-50">I&apos;m a farmer</h2>
          <p className="mt-2 text-sm leading-6">Manage your listings, accept orders and see how your produce is selling.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            <ButtonLink to="/producer/login" className="bg-ivory-50 text-forest-900 hover:bg-white">
              Producer sign in
            </ButtonLink>
            <ButtonLink to="/producer/register" variant="ghost" className="text-ivory-50 hover:bg-white/10">
              Register your farm
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
