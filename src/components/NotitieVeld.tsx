import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";
import { getNotitie, useStore, zetNotitie } from "../lib/store";

/**
 * Notitie bij een badge voor één leerling: een tekst die de leerling ziet en een interne
 * notitie die enkel mentoren/beheerders zien. Opent als klein paneel (portal) bij de badge.
 */
export function NotitieVeld({
  schooljaar,
  studentId,
  leerdoelId,
  readonly = false,
}: {
  schooljaar: string;
  studentId: string;
  leerdoelId: string;
  readonly?: boolean;
}) {
  const { notities } = useStore();
  const n = getNotitie(notities, schooljaar, studentId, leerdoelId);
  const heeft = Boolean(n.zichtbaar || n.verborgen);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pos = usePopover(open, trigger, () => setOpen(false), { breedte: 360, hoogte: 260 });

  return (
    <span className="notitie">
      <button
        ref={trigger}
        type="button"
        className={`notitie-knop${heeft ? " heeft-notitie" : ""}`}
        aria-expanded={open}
        title={heeft ? "Notitie bekijken/bewerken" : "Notitie toevoegen"}
        onClick={() => setOpen((o) => !o)}
      >
        {heeft ? "💬" : "+ notitie"}
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              className="rating-cell-backdrop"
              aria-label="Sluiten"
              onClick={() => setOpen(false)}
            />
            <div className="notitie-panel zwevend-menu" style={{ top: pos.top, left: pos.left }}>
              <label className="notitie-veld">
                <span>Zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  defaultValue={n.zichtbaar}
                  onBlur={(e) =>
                    zetNotitie(schooljaar, studentId, leerdoelId, { zichtbaar: e.target.value })
                  }
                />
              </label>
              <label className="notitie-veld">
                <span>Interne notitie · niet zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  defaultValue={n.verborgen}
                  onBlur={(e) =>
                    zetNotitie(schooljaar, studentId, leerdoelId, { verborgen: e.target.value })
                  }
                />
              </label>
              <button type="button" className="linkknop" onClick={() => setOpen(false)}>
                Sluiten
              </button>
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
