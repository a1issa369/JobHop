// A plain-English privacy policy, not a law firm's. It's accurate to what
// this app actually stores and sends (see supabase/schema.sql and
// src/lib/errorReporting.js) rather than a generic boilerplate template -
// but it is NOT legal advice, and the disclaimer below says so up front.
// Update the two dates and the contact email before this goes live, and
// update the body itself if what the app collects changes.
const LAST_UPDATED = 'October 4, 2026';
// TODO: swap in a real contact address before this goes live - a personal
// inbox you're fine listing publicly, or a dedicated one.
const CONTACT_EMAIL = 'contact@jobhop.app';

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-semibold text-paper">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div className="card-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-xs text-ink2">Last updated {LAST_UPDATED}</p>

        <p className="mt-4 rounded-lg border border-grid bg-ink/40 p-3 text-xs leading-relaxed text-ink2">
          This is a plain-language description of what JobHop collects and why, written for a
          personal/portfolio project - it isn't legal advice, and it isn't a substitute for a
          lawyer if you need one for your own use of this policy. If something here is unclear,
          email {CONTACT_EMAIL}.
        </p>

        <Section title="What this covers">
          <p>
            This policy covers JobHop, a job-application tracker. It applies to anyone who
            creates an account, whether or not you end up using every feature.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <strong className="text-paper">Account info:</strong> the email and password you sign
            up with, plus a username and optional display name.
          </p>
          <p>
            <strong className="text-paper">Profile info you choose to add:</strong> a profile
            photo, your school, and links to your LinkedIn and GitHub profiles.
          </p>
          <p>
            <strong className="text-paper">Your resume:</strong> if you upload one, it's stored
            privately and only accessible to you (and anyone you explicitly share a link with) -
            it is never public by default.
          </p>
          <p>
            <strong className="text-paper">Application data:</strong> the job applications you
            track - company, role, stage, deadline, notes - and the history of how each one moved
            between stages. This is what the dashboard's charts are built from.
          </p>
          <p>
            <strong className="text-paper">Social activity:</strong> who you follow and who
            follows you, duel challenges between you and friends, and the notifications those
            generate (new followers, duel results, friends' applications).
          </p>
          <p>
            <strong className="text-paper">Basic technical info:</strong> standard things any web
            app sees, like your browser and IP address at the time of a request (used for things
            like rate-limiting repeated login attempts, not for tracking).
          </p>
        </Section>

        <Section title="What we don't collect">
          <p>
            We don't buy, sell, or share your data with advertisers or data brokers. There are no
            third-party ad trackers on this site.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            JobHop uses Vercel Analytics to see aggregate things like which pages get visited and
            how fast they load. It's cookie-free and doesn't track you individually across sites -
            that's also why this site doesn't need a cookie-consent banner.
          </p>
        </Section>

        <Section title="Error reporting">
          <p>
            If JobHop crashes unexpectedly, a report (what broke, and a technical stack trace) may
            be sent to our error-tracking tool so it can be fixed. This is about catching bugs,
            not about watching what you do.
          </p>
        </Section>

        <Section title="Who can see what">
          <p>
            Your username, display name, profile photo, school, and social links are visible to
            other JobHop users by design - that's how following and duels work. Your email,
            password, and resume are never shown to other users. Your application board is private
            unless a feature says otherwise.
          </p>
        </Section>

        <Section title="How your data is stored">
          <p>
            Everything is stored with Supabase (hosted on their infrastructure) behind
            database-level access rules, so a request for your data has to come from you, signed
            in as you. Passwords are hashed, never stored in plain text, and we can't see them.
          </p>
        </Section>

        <Section title="Your choices">
          <p>You can at any time, from your account settings:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Edit or remove your profile info, resume, and social links.</li>
            <li>Delete all of your application cards and their history.</li>
            <li>Delete your account entirely, which removes your data from JobHop.</li>
          </ul>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes in a way that matters, the date at the top will update. Keep
            using JobHop after a change and that means you've seen and accepted the update.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data: {CONTACT_EMAIL}.
          </p>
        </Section>
      </div>
    </div>
  );
}
