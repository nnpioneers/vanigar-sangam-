import React from 'react';
import Image from 'next/image';
import styles from './login.module.css';

export function LoginBrandPanel() {
  return (
    <aside className={styles.leftPanel} aria-label="Vanigar Sangam Association Overview">
      <Image
        src="/assets/login-new-bg.jpg"
        alt="Vanigar Sangam Login Background"
        fill
        style={{ objectFit: 'cover' }}
        priority
      />
    </aside>
  );
}
