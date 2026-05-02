import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', variant = 'rectangular', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-zinc-200 dark:bg-zinc-700';
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}


export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton variant="text" width="80%" height={16} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-t border-zinc-100 dark:border-zinc-800">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <Skeleton variant="text" width={`${70 + Math.random() * 20}%`} height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/** Skeleton for card-based list pages (Dispatch, Customers, Invoices, Vehicles). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-3 flex items-center gap-3"
        >
          <Skeleton variant="circular" width={36} height={36} className="shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton variant="text" width="55%" height={13} />
            <Skeleton variant="text" width="35%" height={11} />
          </div>
          <div className="shrink-0 space-y-1.5 text-right">
            <Skeleton variant="text" width={64} height={13} />
            <Skeleton variant="text" width={48} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}


export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" width={120} height={40} />
      </div>
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}