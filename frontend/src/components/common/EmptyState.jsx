export function EmptyState({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
