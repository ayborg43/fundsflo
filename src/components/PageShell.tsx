// The one page container. Six screens had each picked their own max-width and
// top padding, so the column jumped width as you moved through the app. Owning
// it here means the next screen inherits the measure instead of guessing it.
//
// The chat screen is the deliberate exception: it is pinned to the viewport
// with its own scroll container, so it composes the same max-width itself.
export default function PageShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-2xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7 ${className}`}>
      {children}
    </div>
  );
}
