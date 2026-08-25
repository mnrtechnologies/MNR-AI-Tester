import React from 'react';

export default function ShimmerBar() {
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-orange-100">
      <div className="h-full rounded-full shimmer-bar" />
    </div>
  );
}
