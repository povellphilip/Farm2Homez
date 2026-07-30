export function Card({ className = '', ...props }) {
  return <div className={`rounded-lg border border-line bg-white shadow-sm ${className}`} {...props} />;
}
