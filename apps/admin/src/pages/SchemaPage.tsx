import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { VITE_DS_REGISTRY_API } from '../api/client';
import './Page.css';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  look: 'classic',
  er: {
    useMaxWidth: false,
  },
});

function SchemaPage() {
  const [dbml, setDbml] = useState('');
  const [mermaidText, setMermaidText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const transform = useRef({ x: 0, y: 0, scale: 1 });

  const applyTransform = useCallback(() => {
    if (!svgRef.current) return;
    const { x, y, scale } = transform.current;
    svgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const resetView = useCallback(() => {
    transform.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    fetch(`${VITE_DS_REGISTRY_API}/schema`)
      .then((r) => r.json())
      .then((data) => {
        setDbml(data.dbml);
        setMermaidText(data.mermaid);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mermaidText || !svgRef.current) return;

    let cancelled = false;
    mermaid.render('er-diagram', mermaidText).then(({ svg }) => {
      if (!cancelled && svgRef.current) {
        svgRef.current.innerHTML = svg;
        const svgEl = svgRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = 'none';
          svgEl.style.height = 'auto';
          // Remove borders from entity boxes (keep dividers)
          svgEl.querySelectorAll('.node.default > g:not(.divider):not(.label) > path').forEach((p) => {
            if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none') {
              p.setAttribute('stroke', 'none');
            }
          });
        }
      }
    }).catch((err) => {
      if (!cancelled) setError(`Mermaid render error: ${err}`);
    });

    return () => { cancelled = true; };
  }, [mermaidText]);

  // Pan handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    transform.current.x += dx;
    transform.current.y += dy;
    applyTransform();
  }, [applyTransform]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Zoom — native listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const oldScale = transform.current.scale;
      const newScale = Math.min(Math.max(oldScale * delta, 0.1), 5);
      const ratio = newScale / oldScale;

      transform.current.x = pointerX - ratio * (pointerX - transform.current.x);
      transform.current.y = pointerY - ratio * (pointerY - transform.current.y);
      transform.current.scale = newScale;
      applyTransform();
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [applyTransform, loading, error]);

  return (
    <div className="page">
      <div className="schema-header">
        {!loading && !error && (
          <button className="schema-reset-btn" onClick={resetView}>
            Reset view
          </button>
        )}
      </div>

      {loading && <p className="page-hint">Loading schema...</p>}
      {error && <p className="page-error">{error}</p>}

      {!loading && !error && (
        <>
          <div
            className="schema-diagram"
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="schema-diagram-inner" ref={svgRef} />
          </div>

          <details className="schema-code-details">
            <summary>DBML</summary>
            <pre className="nl-query-sql">{dbml}</pre>
          </details>

          <details className="schema-code-details">
            <summary>Mermaid</summary>
            <pre className="nl-query-sql">{mermaidText}</pre>
          </details>
        </>
      )}
    </div>
  );
}

export default SchemaPage;
