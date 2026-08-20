const foundation = [
  "Next.js 16 App Router",
  "TypeScript strict mode",
  "Supabase SSR clients",
  "RTL/LTR locale contract",
  "Deny-by-default access primitives",
  "Unit and E2E test harness"
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between rounded-[2rem] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(19,45,30,0.08)] sm:p-10 lg:p-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-strong">
            Phase 0 · Repository bootstrap
          </p>
          <p className="m-0 text-sm text-foreground/60">Architecture locked</p>
        </div>

        <div className="max-w-3xl py-14 sm:py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Madarsa ERP
          </p>
          <h1 className="m-0 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Foundation before features.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-foreground/68 sm:text-xl">
            Secure multi-tenant groundwork for configurable academics, Hifz,
            finance, operations, and multilingual portals.
          </p>
        </div>

        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {foundation.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-border bg-surface-muted px-5 py-4 text-sm font-medium"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
