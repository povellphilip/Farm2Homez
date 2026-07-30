export function Button({ as: Component = 'button', className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-ink text-white hover:bg-black',
    secondary: 'border border-line bg-white text-ink hover:bg-surface',
    ghost: 'text-ink hover:bg-surface',
  };

  return (
    <Component
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
