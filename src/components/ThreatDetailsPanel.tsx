import { useState } from 'react';
import { X, ExternalLink, Copy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Threat } from '@/types/threat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface ThreatDetailsPanelProps {
  threat: Threat;
  onClose: () => void;
  onOpenActModal: (threat: Threat) => void;
}

const ThreatDetailsPanel = ({ threat, onClose, onOpenActModal }: ThreatDetailsPanelProps) => {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);

  const getSeverityColor = () => {
    switch (threat.severity) {
      case 'Critical': return 'bg-danger text-danger-foreground';
      case 'High': return 'bg-warning text-warning-foreground';
      case 'Medium': return 'bg-primary text-primary-foreground';
      case 'Low': return 'bg-muted text-foreground';
    }
  };

  const getStatusColor = () => {
    switch (threat.status) {
      case 'New': return 'bg-accent text-accent-foreground';
      case 'Active': return 'bg-warning text-warning-foreground';
      case 'Mitigated': return 'bg-success text-success-foreground';
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/threat/${threat.id}`);
    toast.success('Link copied to clipboard');
  };

  const viewAdvisory = () => {
    // Stub handler - in a real app, this would open the advisory URL
    toast.info('Opening advisory...');
  };

  return (
    <div className="w-[420px] glass-card rounded-2xl h-[calc(100vh-8rem)] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{threat.name}</h2>
            <p className="text-sm text-muted-foreground">({threat.asset})</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Badge className={getSeverityColor()}>{threat.severity}</Badge>
          <Badge className={getStatusColor()}>{threat.status}</Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Meta Grid */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">Threat Intelligence</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Source</p>
                <p className="font-medium">{threat.source}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">First Seen</p>
                <p className="font-medium">{new Date(threat.first_seen).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Updated</p>
                <p className="font-medium">{new Date(threat.last_updated).toLocaleDateString('en-GB')}</p>
              </div>
              {threat.confidence && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Confidence</p>
                  <p className="font-medium">{threat.confidence}</p>
                </div>
              )}
              {threat.kill_chain_phase && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">MITRE ATT&CK Phase</p>
                  <p className="font-medium">{threat.kill_chain_phase}</p>
                </div>
              )}
              {threat.score && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Risk Score</p>
                  <p className="font-medium">{threat.score}/100</p>
                </div>
              )}
            </div>
          </div>

          {/* CVEs */}
          {threat.cves && threat.cves.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">CVE List</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.cves.map((cve) => (
                    <Badge key={cve} variant="outline" className="font-mono text-xs">
                      {cve}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Affected Versions */}
          {threat.affected_versions && threat.affected_versions.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Affected Versions</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.affected_versions.map((version, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {version}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Description - Collapsible */}
          <Separator />
          <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Description</h3>
              {isDescriptionOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{threat.description}</p>
            </CollapsibleContent>
          </Collapsible>

          {/* IOCs */}
          {threat.iocs && threat.iocs.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 text-sm">Indicators of Compromise</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Value</TableHead>
                      <TableHead className="text-xs">First Seen</TableHead>
                      <TableHead className="text-xs">Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {threat.iocs.map((ioc, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{ioc.type}</TableCell>
                        <TableCell className="text-xs font-mono">{ioc.value}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ioc.first_seen ? new Date(ioc.first_seen).toLocaleDateString('en-GB') : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ioc.last_seen ? new Date(ioc.last_seen).toLocaleDateString('en-GB') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Recommended Actions */}
          {threat.recommended_actions && threat.recommended_actions.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Recommended Actions
                </h3>
                <ul className="space-y-2">
                  {threat.recommended_actions.map((action, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span className="flex-1 text-muted-foreground">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-6 border-t border-border space-y-2">
        <Button onClick={() => onOpenActModal(threat)} className="w-full" size="lg">
          Act
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={viewAdvisory}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Advisory
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={copyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThreatDetailsPanel;
