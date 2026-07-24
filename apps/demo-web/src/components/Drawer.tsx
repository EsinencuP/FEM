import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function Drawer({ open, title, description, onClose, children }: DrawerProps): ReactNode {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer__header">
          <div>
            <p className="eyebrow">Работа с записью</p>
            <h2 id="drawer-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button ref={closeButton} className="icon-button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </section>
    </div>
  );
}
