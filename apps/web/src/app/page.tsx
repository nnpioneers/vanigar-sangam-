import { redirect } from 'next/navigation';

/**
 * Root route — redirects directly to the Login page.
 */
export default function Home() {
  redirect('/login');
}
