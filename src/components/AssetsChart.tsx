import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AssetImpact } from '@/types/threat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAllAssetImpacts } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AssetsChartProps {
  data: AssetImpact[];
  onAssetClick?: (asset: string) => void;
}

const AssetsChart = ({ data, onAssetClick }: AssetsChartProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allData, setAllData] = useState<AssetImpact[]>([]);
  const [loading, setLoading] = useState(false);

  const barColors = [
    'hsl(var(--danger))',
    'hsl(var(--warning))',
    'hsl(var(--info))',
    'hsl(var(--primary))',
    'hsl(var(--muted))',
  ];

  const handleChartClick = async (e: React.MouseEvent) => {
    // Only open modal if clicking on the chart container, not on bars
    if ((e.target as HTMLElement).closest('.recharts-bar')) {
      return; // Let bar clicks go to onAssetClick
    }
    
    setIsModalOpen(true);
    setLoading(true);
    try {
      const allAssetsData = await getAllAssetImpacts();
      setAllData(allAssetsData);
    } catch (error) {
      console.error('Error fetching all asset impacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarClick = (data: any) => {
    if (onAssetClick) {
      onAssetClick(data.asset);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full cursor-pointer" onClick={handleChartClick}>
        <h3 className="text-md font-semibold mb-4">Assets / Products Impacted</h3>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                type="category" 
                dataKey="asset" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10}
                width={100}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
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
                onClick={handleBarClick}
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
          Click chart to view all products • Click bars to filter
        </p>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 [&>button]:z-10">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-xl">Assets / Products Impacted - Full List</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-120px)] px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : allData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">No asset data available</p>
              </div>
            ) : (
              <div className="w-full py-4" style={{ minWidth: '800px' }}>
                <ResponsiveContainer width="100%" height={Math.max(400, allData.length * 50)}>
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
                      dataKey="asset"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={150}
                      tick={{ fontSize: 10 }}
                      interval={0}
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
                      onClick={handleBarClick}
                      className="cursor-pointer"
                    >
                      {allData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={barColors[index % barColors.length]} 
                        />
                      ))}
                    </Bar>
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

export default AssetsChart;
