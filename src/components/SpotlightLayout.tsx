import React, { ReactNode } from 'react';

interface SpotlightLayoutProps {
  title: string;
  filters: ReactNode;
  children: ReactNode;
}

const SpotlightLayout: React.FC<SpotlightLayoutProps> = ({ title, filters, children }) => {
  return (
    <div className="flex flex-col h-[95vh] w-full">
      {/* Header */}
      <div className="border-b border-border p-3 shrink-0">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      
      {/* Main Grid */}
      <div className="grid grid-cols-[280px_1fr] flex-1 min-h-0">
        {/* Left Sidebar */}
        <div className="border-r border-border p-4 overflow-y-auto bg-card/50">
          <div className="space-y-4">
            {filters}
          </div>
        </div>
        
        {/* Right Chart Area - Full parent container responsiveness */}
        <div className="relative flex items-center justify-center overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SpotlightLayout;

