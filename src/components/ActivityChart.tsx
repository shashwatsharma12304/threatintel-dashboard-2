import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ActivityDataPoint } from '@/types/threat';

interface ActivityChartProps {
  data: ActivityDataPoint[];
}

const ActivityChart = ({ data }: ActivityChartProps) => {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-md font-semibold mb-4">Activity Diagnostics</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
            <Bar dataKey="Critical" stackId="a" fill="hsl(var(--danger))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="High" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Medium" stackId="a" fill="hsl(var(--info))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Low" stackId="a" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActivityChart;
