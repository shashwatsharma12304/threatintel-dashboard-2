import { Activity, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';
import { KpiData } from '@/types/threat';

interface KpiCardsProps {
  data: KpiData;
}

const KpiCards = ({ data }: KpiCardsProps) => {
  const cards = [
    {
      title: 'Active Threats',
      value: data.active,
      icon: Activity,
      color: 'text-primary',
    },
    {
      title: 'Critical Open',
      value: data.critical,
      icon: AlertTriangle,
      color: 'text-danger',
    },
    {
      title: 'High Severity',
      value: data.high,
      icon: ShieldCheck,
      color: 'text-warning',
    },
    {
      title: 'New (24h)',
      value: data.newLast24h,
      icon: TrendingUp,
      color: 'text-info',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={card.title}
          className="bg-card p-4 rounded-lg flex items-center justify-between card-shadow"
        >
          <div>
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
          <div className={`p-3 bg-gray-100 rounded-lg ${card.color}`}>
              <card.icon className="h-6 w-6" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
