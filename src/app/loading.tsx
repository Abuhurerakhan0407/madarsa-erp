export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center p-6" aria-busy="true">
      <p className="rounded-full bg-surface px-5 py-3 text-sm text-foreground/70 shadow-sm">
        Loading…
      </p>
    </main>
  );
}
