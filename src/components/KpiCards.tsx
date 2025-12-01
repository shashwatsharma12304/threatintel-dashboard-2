import { Activity, AlertTriangle, ShieldCheck, TrendingUp, Package, CheckCircle } from 'lucide-react';
import { KpiData, Threat } from '@/types/threat';

interface KpiCardsProps {
  data: KpiData;
  threats: Threat[];
  onCardClick: (cardType: 'active' | 'critical' | 'high' | 'new24h' | 'assets' | 'mitigated', threats: Threat[]) => void;
}

const KpiCards = ({ data, threats, onCardClick }: KpiCardsProps) => {
  const getThreatsForCard = (cardType: 'active' | 'critical' | 'high' | 'new24h' | 'assets' | 'mitigated'): Threat[] => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    switch (cardType) {
      case 'active':
        return threats.filter(t => t.status === 'active' || t.status === 'new');
      case 'critical':
        return threats.filter(t => t.severity === 'critical' && t.status !== 'mitigated');
      case 'high':
        return threats.filter(t => t.severity === 'high' && t.status !== 'mitigated');
      case 'new24h':
        return threats.filter(t => {
          if (!t.first_seen) return false;
          const firstSeenDate = new Date(t.first_seen);
          return firstSeenDate >= last24h;
        });
      case 'assets':
        return threats; // All threats have assets
      case 'mitigated':
        return threats.filter(t => t.status === 'mitigated');
      default:
        return [];
    }
  };

  const mitigatedCount = threats.filter(t => t.status === 'mitigated').length;

  const cards = [
    {
      title: 'Active Threats',
      value: data.active,
      icon: Activity,
      color: 'text-primary',
      type: 'active' as const,
    },
    {
      title: 'Critical Open',
      value: data.critical,
      icon: AlertTriangle,
      color: 'text-danger',
      type: 'critical' as const,
    },
    {
      title: 'High Severity',
      value: data.high,
      icon: ShieldCheck,
      color: 'text-warning',
      type: 'high' as const,
    },
    {
      title: 'New (24h)',
      value: data.newLast24h,
      icon: TrendingUp,
      color: 'text-info',
      type: 'new24h' as const,
    },
    {
      title: 'Assets Impacted',
      value: data.assetsImpacted,
      icon: Package,
      color: 'text-purple-500',
      type: 'assets' as const,
    },
    {
      title: 'Mitigated',
      value: mitigatedCount,
      icon: CheckCircle,
      color: 'text-green-500',
      type: 'mitigated' as const,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-sm font-semibold mb-3 lg:mb-4">Key Metrics</h3>
      <div className="flex-1 flex flex-col gap-2.5 lg:gap-3 overflow-y-auto">
        {cards.map((card) => {
          const cardThreats = getThreatsForCard(card.type);
          return (
            <div
              key={card.title}
              className="bg-accent/30 px-3.5 py-3 lg:px-4 lg:py-4 rounded-lg flex flex-col cursor-pointer hover:bg-accent/50 transition-colors border border-border"
              onClick={() => onCardClick(card.type, cardThreats)}
            >
              <div className="flex items-start justify-between mb-2 lg:mb-3">
                <p className="text-[10px] lg:text-xs text-muted-foreground font-medium leading-tight pr-2">{card.title}</p>
                <div className={`p-1 lg:p-1.5 bg-background/50 rounded ${card.color} shrink-0 ml-auto`}>
                  <card.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-bold leading-none">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KpiCards;
