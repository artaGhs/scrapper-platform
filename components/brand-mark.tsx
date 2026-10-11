export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 10V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3v4l6-4h1" />
      <path d="M8 8h10M8 12h6" />
      <circle cx="19" cy="18" r="5" />
      <path d="m22.5 21.5 3.5 3.5" />
    </svg>
  );
}
