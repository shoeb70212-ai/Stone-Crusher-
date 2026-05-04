import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { ErpProvider } from '../context/ErpContext';

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ErpProvider, null, children);
}

describe('useFeatureFlag', () => {
  it('returns false when flag is absent', () => {
    const { result } = renderHook(() => useFeatureFlag('nonexistent'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  // Note: testing true requires mocking companySettings context value.
  // This is covered by e2e once flags are toggled in Supabase.
});
