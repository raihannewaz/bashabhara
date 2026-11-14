export default function Loading() {
  return (
    <main>
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
      </div>
    </main>
  );
}
