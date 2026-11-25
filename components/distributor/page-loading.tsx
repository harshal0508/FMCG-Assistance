import React from 'react';

export default function PageLoading() {
  return (
    <div className="w-full min-h-[40vh] flex items-center justify-center p-8">
      <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-[#17307A] animate-spin" />
    </div>
  );
}
