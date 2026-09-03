import { type ReactNode, useEffect } from "react";

/**
 * Eenvoudige gecentreerde overlay. Sluit met de knop, een klik naast het venster of Escape.
 * Terwijl de modal open staat, scrollt de pagina eronder niet mee.
 */
export function Modal({
  onClose,
  label,
  groot = false,
  children,
}: {
  onClose: () => void;
  /** Toegankelijke naam van het dialoogvenster. */
  label: string;
  /** Breder venster voor formulieren met veel inhoud (bv. de groep-editor). */
  groot?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const vorige = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = vorige;
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${groot ? " modal--groot" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-sluit" aria-label="Sluiten" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
