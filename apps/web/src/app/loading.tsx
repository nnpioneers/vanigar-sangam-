/**
 * Root loading boundary — minimal, accessible and non-business.
 *
 * No animation system is introduced here; motion handling lives in the
 * global `prefers-reduced-motion` rule.
 */
export default function Loading() {
  return (
    <main id="main-content" className="state-message">
      <p role="status" aria-live="polite">
        Loading…
      </p>
    </main>
  );
}
