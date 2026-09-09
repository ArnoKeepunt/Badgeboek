/**
 * Klein hangslot-icoontje (currentColor) voor "afgesloten / alleen-lezen", bv. bij een
 * vastgezet schooljaar. Zelfde lijnstijl als `Icoon`.
 */
export function SlotIcoon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      className={className}
    >
      <rect x="4" y="10.5" width="16" height="11" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 15v3" />
    </svg>
  );
}
