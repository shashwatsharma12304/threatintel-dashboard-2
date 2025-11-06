import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AssetImpact } from '@/types/threat';

interface AssetsChartProps {
  data: AssetImpact[];
  onAssetClick?: (asset: string) => void;
}

const AssetsChart = ({ data, onAssetClick }: AssetsChartProps) => {
  const barColors = [
    'hsl(var(--danger))',
    'hsl(var(--warning))',
    'hsl(var(--info))',
    'hsl(var(--primary))',
    'hsl(var(--muted))',
  ];

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-md font-semibold mb-4">Assets / Products Impacted</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
              type="category" 
              dataKey="asset" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              width={80}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: '12px'
              }}
              formatter={(value) => [`${value} threats`, 'Count']}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
              onClick={(data) => onAssetClick?.(data.asset)}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={barColors[index % barColors.length]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Click on bars to filter by asset
      </p>
    </div>
  );
};

export default AssetsChart;
