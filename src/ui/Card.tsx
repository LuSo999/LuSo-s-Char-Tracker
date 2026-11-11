export function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-card p-6 shadow-sm">{children}</section>
}
