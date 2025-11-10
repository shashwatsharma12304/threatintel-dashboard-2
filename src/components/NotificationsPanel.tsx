import { useState } from 'react';
import { Threat } from '@/types/threat';
import { Bell, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsPanelProps {
  criticalThreats: Threat[];
  onThreatClick: (threatId: string) => void;
}

const NotificationsPanel = ({ criticalThreats, onThreatClick }: NotificationsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get highly relevant critical threats
  const highlyRelevantCritical = criticalThreats.filter(threat => 
    threat.severity === 'critical' &&
    threat.prioritization_band === 'critical' &&
    threat.status !== 'mitigated' &&
    threat.assets_impacted && threat.assets_impacted.length > 0
  );

  const getPrimaryAsset = (threat: Threat): string => {
    if (threat.assets_impacted && threat.assets_impacted.length > 0) {
      return threat.assets_impacted[0].product_name;
    }
    return 'Unknown Asset';
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {highlyRelevantCritical.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {highlyRelevantCritical.length > 9 ? '9+' : highlyRelevantCritical.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Critical Threat Notifications
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {highlyRelevantCritical.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No critical threats at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {highlyRelevantCritical.map((threat) => (
                <div
                  key={threat.id}
                  className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                  onClick={() => {
                    onThreatClick(threat.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{threat.threat_name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{threat.summary}</p>
                    </div>
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      Critical
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>Asset: {getPrimaryAsset(threat)}</span>
                    <span>•</span>
                    <span>
                      {threat.first_seen ? formatDistanceToNow(new Date(threat.first_seen), { addSuffix: true }) : 'Recently'}
                    </span>
                  </div>
                  
                  {threat.relevance_reasons && threat.relevance_reasons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-red-500/20">
                      <p className="text-xs font-medium text-red-600 mb-1">Relevance:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {threat.relevance_reasons.slice(0, 2).map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationsPanel;

