import { Threat } from '@/types/threat';
import { AlertTriangle } from 'lucide-react';

interface CriticalAlertBarProps {
  criticalThreats: Threat[];
}

const CriticalAlertBar = ({ criticalThreats }: CriticalAlertBarProps) => {
  // Get highly relevant critical threats
  const highlyRelevantCritical = criticalThreats.filter(threat => 
    threat.severity === 'critical' &&
    threat.prioritization_band === 'critical' &&
    threat.status !== 'mitigated' &&
    threat.assets_impacted && threat.assets_impacted.length > 0
  );

  if (highlyRelevantCritical.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shrink-0">
      <AlertTriangle className="h-4 w-4 animate-pulse" />
      <span>
        <strong>{highlyRelevantCritical.length}</strong> highly relevant critical threat{highlyRelevantCritical.length !== 1 ? 's' : ''} about to impact your assets
      </span>
    </div>
  );
};

export default CriticalAlertBar;

