import Link from 'next/link';

/**
 * Not-found boundary — neutral message and a safe route back to the root.
 * It makes no assumption about which modules exist.
 */
export default function NotFound() {
  return (
    <main id="main-content" className="state-message">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist, or it may have moved.</p>
      <div className="state-actions">
        <Link href="/" className="state-link">
          Go to home
        </Link>
      </div>
    </main>
  );
}
