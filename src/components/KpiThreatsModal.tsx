import { Threat } from '@/types/threat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink } from 'lucide-react';
import ActModal from './ActModal';
import { useState } from 'react';

interface KpiThreatsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  threats: Threat[];
  onThreatClick?: (threatId: string) => void;
}

const KpiThreatsModal = ({ open, onClose, title, threats, onThreatClick }: KpiThreatsModalProps) => {
  const [actModalThreat, setActModalThreat] = useState<Threat | null>(null);
  const [actModalOpen, setActModalOpen] = useState(false);

  const getPrimaryAsset = (threat: Threat): string => {
    if (threat.assets_impacted && threat.assets_impacted.length > 0) {
      return threat.assets_impacted[0].product_name;
    }
    return 'Unknown Asset';
  };

  const handleViewAdvisory = (threat: Threat) => {
    if (threat.source_link) {
      window.open(threat.source_link, '_blank');
    } else {
      // If no source link, open the threat details
      if (onThreatClick) {
        onThreatClick(threat.id);
        onClose();
      }
    }
  };

  const handleActClick = (threat: Threat) => {
    setActModalThreat(threat);
    setActModalOpen(true);
  };

  const handleCloseActModal = () => {
    setActModalOpen(false);
    setActModalThreat(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {threats.length} threat{threats.length !== 1 ? 's' : ''} found
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {threats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground">No threats found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {threats.map((threat) => (
                  <div
                    key={threat.id}
                    className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{threat.threat_name}</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Impacting: <span className="font-medium">{getPrimaryAsset(threat)}</span>
                        </p>
                        {threat.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {threat.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewAdvisory(threat)}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Advisory
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleActClick(threat)}
                      >
                        Act
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ActModal
        threat={actModalThreat}
        open={actModalOpen}
        onClose={handleCloseActModal}
      />
    </>
  );
};

export default KpiThreatsModal;

