"use client";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="m-0 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-foreground/65">No data changed. Retry this request.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-accent px-5 py-3 font-semibold text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
