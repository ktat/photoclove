import { createPortal } from 'react-dom';

function Tooltip({ show, text, position }) {
  if (!show) return null;

  return createPortal(
    <div
      className={`tooltip ${show ? 'show' : ''}`}
      style={{ top: `${position.top}px` }}
    >
      {text}
    </div>,
    document.body
  );
}

export default Tooltip;
