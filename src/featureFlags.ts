/**
 * Central registry of feature flags.
 * Every flag key used in the app must be declared here so it is grep-able.
 */
export const FEATURE_FLAGS = {
  /** CT-101 — Per-record timestamp reconciliation in sync queue. */
  syncQueueV2: 'syncQueueV2',
  /** CT-106 — Stable auth dependencies (userId instead of access_token). */
  authStableDeps: 'authStableDeps',
  /** CT-204 — URL-based routing via wouter. */
  urlRouting: 'urlRouting',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
