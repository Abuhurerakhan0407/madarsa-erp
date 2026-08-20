import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="text-center">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <Link className="mt-5 inline-block font-semibold text-accent" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
