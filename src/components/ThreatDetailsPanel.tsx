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

  const capitalizeFirst = (s: string): string => {
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  };

  const getPrimaryAsset = (): string => {
    if (threat.assets_impacted && threat.assets_impacted.length > 0) {
      return threat.assets_impacted[0].product_name;
    }
    return 'Unknown Asset';
  };

  const getSeverityColor = () => {
    switch (threat.severity) {
      case 'critical': return 'bg-danger text-danger-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      case 'low': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusColor = () => {
    switch (threat.status) {
      case 'new': return 'bg-accent text-accent-foreground';
      case 'active': return 'bg-warning text-warning-foreground';
      case 'mitigated': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-foreground';
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
    <div className="w-full sm:w-[320px] md:w-[360px] lg:w-[400px] xl:w-[420px] glass-card rounded-none h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 sm:p-5 lg:p-6 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold mb-1 break-words leading-tight">{threat.threat_name}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">({getPrimaryAsset()})</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mt-1 -mr-1">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Badge className={`${getSeverityColor()} text-xs`}>{capitalizeFirst(threat.severity)}</Badge>
          <Badge className={`${getStatusColor()} text-xs`}>{capitalizeFirst(threat.status)}</Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6">
          {/* Meta Grid */}
          <div>
            <h3 className="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Threat Intelligence</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
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
              <div>
                <p className="text-muted-foreground text-xs mb-1">Prioritization Score</p>
                <p className="font-medium">{(threat.prioritization_score * 100).toFixed(0)}/100</p>
              </div>
              {threat.mitre_tactics && threat.mitre_tactics.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">MITRE ATT&CK Tactics</p>
                  <p className="font-medium">{threat.mitre_tactics[0]}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Primary Surface</p>
                <p className="font-medium">{threat.primary_surface}</p>
              </div>
            </div>
          </div>

          {/* CVEs */}
          {threat.cve_ids && threat.cve_ids.length > 0 && threat.cve_ids.filter(cve => cve && cve !== 'NA').length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">CVE List</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.cve_ids.filter(cve => cve && cve !== 'NA').map((cve) => (
                    <Badge key={cve} variant="outline" className="font-mono text-xs">
                      {cve}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Assets Impacted */}
          {threat.assets_impacted && threat.assets_impacted.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Assets Impacted</h3>
                <div className="space-y-2">
                  {threat.assets_impacted.map((asset, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-sm">
                      <p className="font-medium">{asset.product_name}</p>
                      <div className="flex gap-2 mt-1">
                        {asset.is_crown_jewel && <Badge variant="secondary" className="text-xs">Crown Jewel</Badge>}
                        {asset.internet_facing && <Badge variant="outline" className="text-xs">Internet Facing</Badge>}
                        <Badge variant="outline" className="text-xs">Data: {capitalizeFirst(asset.data_sensitivity)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* MITRE Tactics */}
          {threat.mitre_tactics && threat.mitre_tactics.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">MITRE ATT&CK Tactics</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.mitre_tactics.map((tactic, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tactic}
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
              <h3 className="font-semibold text-sm">Summary</h3>
              {isDescriptionOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{threat.summary}</p>
            </CollapsibleContent>
          </Collapsible>

          {/* Relevance Reasons */}
          {threat.relevance_reasons && threat.relevance_reasons.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Relevance Reasons
                </h3>
                <ul className="space-y-2">
                  {threat.relevance_reasons.map((reason, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span className="flex-1 text-muted-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Industries Affected */}
          {threat.industries_affected && threat.industries_affected.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Industries Affected</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.industries_affected.map((industry, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Regions Targeted */}
          {threat.regions_or_countries_targeted && threat.regions_or_countries_targeted.length > 0 && 
           threat.regions_or_countries_targeted.filter(r => r && r !== 'NA').length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Regions/Countries Targeted</h3>
                <div className="flex flex-wrap gap-2">
                  {threat.regions_or_countries_targeted.filter(r => r && r !== 'NA').map((region, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 sm:p-5 lg:p-6 border-t border-border space-y-2">
        <Button onClick={() => onOpenActModal(threat)} className="w-full" size="default">
          Act
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={viewAdvisory}>
            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            View Advisory
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={copyLink}>
            <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Copy Link
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThreatDetailsPanel;
