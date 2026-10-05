// Same approach as Privacy.jsx: plain-English, accurate to what this app
// actually does, clearly NOT legal advice. Update the date and contact
// email before going live.
const LAST_UPDATED = 'October 4, 2026';
// One address for everything (support, bugs, legal questions) rather than
// splitting across several inboxes for a solo project. A free Outlook
// account rather than something @jobhop.me, since mailbox hosting on the
// domain isn't set up - perfectly normal for a solo/student project.
// Privacy.jsx uses the same constant name/value, so update both if it changes.
const SUPPORT_EMAIL = 'JobHop.me@outlook.com';

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-semibold text-paper">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink2">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div className="card-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Terms &amp; Conditions</h1>
        <p className="mt-1 text-xs text-ink2">Last updated {LAST_UPDATED}</p>

        <p className="mt-4 rounded-lg border border-grid bg-ink/40 p-3 text-xs leading-relaxed text-ink2">
          This is a plain-language set of terms for a personal/portfolio project, not a
          lawyer-drafted contract - it isn't legal advice. By creating a JobHop account, you're
          agreeing to the terms below.
        </p>

        <Section title="What JobHop is">
          <p>
            JobHop is a job-application tracker: a board for your own applications, plus optional
            social features (following friends, friendly duels based on application activity) and
            a resume upload. It's a personal project, not a commercial product, and is provided as-is.
          </p>
        </Section>

        <Section title="Independent student project">
          <p>
            JobHop is an independent, student-built project and is not affiliated with, sponsored
            by, or endorsed by any third-party company, employer, platform, or organization using
            a similar name. If a valid trademark or naming concern is raised, the project may be
            rebranded. To report bugs or support issues, contact {SUPPORT_EMAIL}.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You're responsible for the accuracy of what you enter and for keeping your password
            private. You must be old enough to legally use a web service like this in your
            location. One account per person - don't create accounts to impersonate someone else
            or to manipulate duels or leaderboards.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to use JobHop to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Upload anything illegal, abusive, or that isn't actually your own resume/content.</li>
            <li>Try to access another user's data, account, or private application board.</li>
            <li>Disrupt the service (scraping at scale, automated abuse, attempting to bypass rate limits).</li>
            <li>Use the social features to harass another user.</li>
          </ul>
          <p>
            Violating these may result in your account being suspended or removed.
          </p>
        </Section>

        <Section title="Your content">
          <p>
            You keep ownership of what you upload (your resume, profile photo, application notes).
            You're giving JobHop permission to store and display it back to you - and, for the
            parts that are social by design (your profile, your public application activity used
            in duels/notifications), to show it to the friends you connect with - strictly to
            operate the app, not to use it for anything else.
          </p>
        </Section>

        <Section title="Availability">
          <p>
            This is run as a personal project rather than a company with an uptime guarantee.
            Features may change, and the service could go offline or be discontinued. If that
            ever happens, reasonable notice will be given where possible so you can export or
            remove your data first.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            JobHop is provided "as is," without warranties of any kind. It's a tool to help
            organize your job search, not a guarantee of outcomes - use your own judgment about
            deadlines and decisions, and keep an independent record of anything critical.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the extent allowed by law, JobHop and its creator aren't liable for indirect
            damages (like a missed deadline or lost job opportunity) arising from using or being
            unable to use the service.
          </p>
        </Section>

        <Section title="Ending your account">
          <p>
            You can delete your account at any time from Settings, which removes your data from
            JobHop. We may also suspend or remove an account that violates the acceptable-use
            terms above.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If these terms change in a way that matters, the date at the top will update.
            Continuing to use JobHop after a change means you accept the update.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms: {SUPPORT_EMAIL}.</p>
        </Section>
      </div>
    </div>
  );
}
