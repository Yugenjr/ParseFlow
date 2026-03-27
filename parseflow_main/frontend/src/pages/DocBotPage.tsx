import React from 'react';
import { DocBotSidebar } from '@/components/DocBotSidebar';

export default function DocBotPage() {
  return (
    <div className="p-6">
      <h2 className="font-heading text-2xl mb-4">DocBot — Your Vault Assistant</h2>
      <div className="max-w-2xl">
        <DocBotSidebar />
      </div>
    </div>
  );
}
