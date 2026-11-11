import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Rotate 180° so a player on the far side of the table can read it. */
  flip?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, subtitle, flip, onClose, children, footer }: Props) {
  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${flip ? ' flip' : ''}`} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
        {children}
        {footer ?? (
          <button className="close" onClick={onClose}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, hot, label }: { value: number; onChange: (d: number) => void; hot?: boolean; label: string }) {
  return (
    <div className="stepper">
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(-1)}>−</button>
      <span className={`v num${hot ? ' hot' : ''}`}>{value}</span>
      <button aria-label={`Increase ${label}`} onClick={() => onChange(1)}>+</button>
    </div>
  );
}
