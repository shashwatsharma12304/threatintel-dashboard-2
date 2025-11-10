import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ActivityDataPoint } from '@/types/threat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAllActivityData } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityChartProps {
  data: ActivityDataPoint[];
}

const ActivityChart = ({ data }: ActivityChartProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allData, setAllData] = useState<ActivityDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const handleChartClick = async () => {
    setIsModalOpen(true);
    setLoading(true);
    try {
      const allActivityData = await getAllActivityData();
      setAllData(allActivityData);
    } catch (error) {
      console.error('Error fetching all activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full cursor-pointer" onClick={handleChartClick}>
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
        <p className="text-xs text-muted-foreground text-center mt-2">
          Click to view full history
        </p>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 [&>button]:z-10">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-xl">Activity Diagnostics - Full History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-120px)] px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : allData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">No activity data available</p>
              </div>
            ) : (
              <div className="w-full py-4" style={{ minWidth: '800px' }}>
                <ResponsiveContainer width="100%" height={Math.max(400, allData.length * 40)}>
                  <BarChart data={allData} layout="vertical" margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                    <XAxis 
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      type="category"
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} iconType="circle" />
                    <Bar dataKey="Critical" stackId="a" fill="hsl(var(--danger))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="High" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Medium" stackId="a" fill="hsl(var(--info))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Low" stackId="a" fill="hsl(var(--muted))" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ActivityChart;
