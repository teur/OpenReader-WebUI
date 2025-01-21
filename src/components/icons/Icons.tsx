export const PlayIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="16"
      cy="16"
      r="15"
      stroke="currentColor"
      strokeWidth="2"
      className="transition-colors"
    />
    <path
      d="M21.5 15.134c.667.385.667 1.347 0 1.732l-7.5 4.33c-.667.386-1.5-.096-1.5-.866V11.67c0-.77.833-1.252 1.5-.866l7.5 4.33z"
      fill="currentColor"
      className="transition-colors"
    />
  </svg>
);

export const PauseIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="16"
      cy="16"
      r="15"
      stroke="currentColor"
      strokeWidth="2"
      className="transition-colors"
    />
    <rect
      x="12"
      y="11"
      width="2.5"
      height="10"
      rx="1"
      fill="currentColor"
      className="transition-colors"
    />
    <rect
      x="17.5"
      y="11"
      width="2.5"
      height="10"
      rx="1"
      fill="currentColor"
      className="transition-colors"
    />
  </svg>
);

export const SkipForwardIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 4l10 8-10 8V4z"
      fill="currentColor"
      className="transition-colors"
    />
    <rect
      x="16"
      y="4"
      width="2"
      height="16"
      rx="1"
      fill="currentColor"
      className="transition-colors"
    />
  </svg>
);

export const SkipBackwardIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 4L8 12l10 8V4z"
      fill="currentColor"
      className="transition-colors"
    />
    <rect
      x="6"
      y="4"
      width="2"
      height="16"
      rx="1"
      fill="currentColor"
      className="transition-colors"
    />
  </svg>
);

export function ChevronUpDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={props.className}
      width={props.width || "1.5em"}
      height={props.height || "1.5em"}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
