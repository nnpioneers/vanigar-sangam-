import React from 'react';
import Image from 'next/image';
import styles from './login.module.css';

export function LoginBrandPanel() {
  return (
    <aside className={styles.leftPanel} aria-label="Vanigar Sangam Association Overview">
      <div className={styles.leftOverlay} />

      {/* Top Branding Section */}
      <div className={styles.leftTopBrand}>
        <div className={styles.emblemWrapper}>
          <Image
            src="/assets/vanigar-emblem.png"
            alt="Vanigar Sangam Emblem"
            className={styles.emblemImg}
            width={130}
            height={100}
            priority
          />
        </div>

        <h1 className={styles.brandTitle}>VANIGAR SANGAM</h1>

        <div className={styles.townFlank}>
          <span className={styles.flankLine} aria-hidden="true" />
          <span className={styles.townName}>LAPPAIKUDIKADU</span>
          <span className={styles.flankLine} aria-hidden="true" />
        </div>

        <p className={styles.togetherTag}>Together We Grow</p>

        <p className={styles.tamilTagline}>
          வணிகர்களின் வளர்ச்சிக்கு...
          <br />
          நாம் ஒன்றாக...
        </p>
      </div>

      {/* Bottom Highlights & Town Identity */}
      <div className={styles.leftBottomArea}>
        <div className={styles.featureStrip} role="list" aria-label="Association Key Features">
          {/* 1. Member Support */}
          <div className={styles.featureItem} role="listitem">
            <svg
              className={styles.featureIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
              />
            </svg>
            <span className={styles.featureLabel}>Member Support</span>
          </div>

          {/* 2. Loan Facilities */}
          <div className={styles.featureItem} role="listitem">
            <svg
              className={styles.featureIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className={styles.featureLabel}>Loan Facilities</span>
          </div>

          {/* 3. Secure Transactions */}
          <div className={styles.featureItem} role="listitem">
            <svg
              className={styles.featureIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className={styles.featureLabel}>Secure Transactions</span>
          </div>

          {/* 4. Business Growth */}
          <div className={styles.featureItem} role="listitem">
            <svg
              className={styles.featureIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <span className={styles.featureLabel}>Business Growth</span>
          </div>

          {/* 5. Strong Community */}
          <div className={styles.featureItem} role="listitem">
            <svg
              className={styles.featureIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className={styles.featureLabel}>Strong Community</span>
          </div>
        </div>

        <div className={styles.locationBar}>
          <svg
            className={styles.locationIcon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Lappaikudikadu, Our Town &nbsp;|&nbsp; Vanigar Sangam Management System</span>
        </div>
      </div>
    </aside>
  );
}
