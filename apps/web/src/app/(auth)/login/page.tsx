import type { Metadata } from 'next';
import { LoginBrandPanel } from '@/components/auth/LoginBrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';
import styles from '@/components/auth/login.module.css';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Secure administrator login for Vanigar Sangam Management System, Lappaikudikadu.',
};

export default function LoginPage() {
  return (
    <main className={styles.loginContainer}>
      {/* Left panel: Association brand identity & scenic town atmosphere */}
      <LoginBrandPanel />

      {/* Right panel: Modern secure login card with traditional ornament watermark */}
      <section className={styles.rightPanel} aria-label="Administrator Sign In">
        <div className={styles.ornamentCorner} aria-hidden="true" />
        <LoginForm />
      </section>
    </main>
  );
}
