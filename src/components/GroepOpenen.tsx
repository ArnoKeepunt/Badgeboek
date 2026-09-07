/** Eén pijltje om een groep te openen in de badgematrix (zet de groep als filter). */
export function GroepOpenen({
  naam,
  onOpen,
}: {
  naam: string;
  onOpen: (pad: string) => void;
}) {
  return (
    <button
      type="button"
      className="groep-openen-knop"
      title={`${naam} openen in de badges`}
      aria-label={`${naam} openen in de badges`}
      onClick={() => onOpen("/badges")}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
