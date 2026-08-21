// One drawn icon family, so UI affordances stop being text glyphs (☰, ✕, →)
// that inherit whatever the font does and land on different optical centres.
// Emoji stay where they are content the user chose or the product means:
// account avatars, category tags, the mood in a chat reply.
//
// All icons share a 24-unit box, 2.75 stroke, round caps and currentColor, so
// they sit together at any size.

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const paths: Record<string, React.ReactNode> = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  send: (
    <>
      <path d="M4 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  paperclip: (
    <path d="M20 11.5l-7.6 7.6a4.6 4.6 0 0 1-6.5-6.5l7.9-7.9a3 3 0 0 1 4.3 4.3l-7.8 7.8a1.5 1.5 0 0 1-2.1-2.1l7.1-7.1" />
  ),
  undo: (
    <>
      <path d="M4 9h10a5 5 0 0 1 0 10h-4" />
      <path d="M8 5L4 9l4 4" />
    </>
  ),
  check: <path d="M5 13l4.5 4.5L19 7" />,
  back: (
    <>
      <path d="M20 12H6" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6.5 7l1 12.5h9L17.5 7" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export default function Icon({
  name,
  size = 22,
  className,
  strokeWidth = 2.75,
}: IconProps & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
