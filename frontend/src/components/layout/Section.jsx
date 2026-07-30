export function Section({ eyebrow, title, description, children, id, className = '' }) {
  return (
    <section id={id} className={`py-20 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || title || description) && (
          <div className="mb-12 max-w-3xl">
            {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wide text-accent">{eyebrow}</p> : null}
            {title ? <h2 className="mt-3 text-3xl font-semibold tracking-normal text-ink sm:text-4xl">{title}</h2> : null}
            {description ? <p className="mt-4 text-base leading-7 text-muted">{description}</p> : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
