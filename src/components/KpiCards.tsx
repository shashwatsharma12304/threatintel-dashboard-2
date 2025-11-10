import { Activity, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';
import { KpiData, Threat } from '@/types/threat';

interface KpiCardsProps {
  data: KpiData;
  threats: Threat[];
  onCardClick: (cardType: 'active' | 'critical' | 'high' | 'new24h', threats: Threat[]) => void;
}

const KpiCards = ({ data, threats, onCardClick }: KpiCardsProps) => {
  const getThreatsForCard = (cardType: 'active' | 'critical' | 'high' | 'new24h'): Threat[] => {
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
      default:
        return [];
    }
  };

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
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => {
        const cardThreats = getThreatsForCard(card.type);
        return (
          <div
            key={card.title}
            className="bg-card p-4 rounded-lg flex items-center justify-between card-shadow cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onCardClick(card.type, cardThreats)}
          >
            <div>
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
            <div className={`p-3 bg-gray-100 rounded-lg ${card.color}`}>
                <card.icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KpiCards;
