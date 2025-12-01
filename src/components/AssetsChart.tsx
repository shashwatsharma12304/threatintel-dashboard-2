import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AssetImpact } from '@/types/threat';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getAssetImpactsFromRadarData } from '@/lib/radarData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import SpotlightLayout from '@/components/SpotlightLayout';

// Custom tick component for truncating long labels
const CustomYAxisTick = ({ x, y, payload, maxWidth = 120 }: any) => {
  const text = payload.value || '';
  // Approximate character limit based on width (roughly 6-7px per character at 11px font)
  const maxChars = Math.floor(maxWidth / 6);
  const truncatedText = text.length > maxChars ? `${text.slice(0, maxChars - 2)}...` : text;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text
        x={-4}
        y={0}
        dy={4}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
      >
        {truncatedText}
      </text>
    </g>
  );
};

interface AssetsChartProps {
  data: AssetImpact[];
  onAssetClick?: (asset: string) => void;
}

const AssetsChart = ({ data, onAssetClick }: AssetsChartProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allData, setAllData] = useState<AssetImpact[]>([]);
  const [loading, setLoading] = useState(false);

  // Spotlight-specific filters
  const [spotlightFilters, setSpotlightFilters] = useState({
    sortBy: 'countDesc' as 'countDesc' | 'countAsc',
    showTop: 'all' as '5' | '10' | '20' | 'all',
  });

  // Reset spotlight filters when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setSpotlightFilters({
        sortBy: 'countDesc',
        showTop: 'all',
      });
    }
  }, [isModalOpen]);

  // Show only top 5 products in preview
  const previewData = data.slice(0, 5);

  const barColors = [
    'hsl(var(--danger))',
    'hsl(var(--warning))',
    'hsl(var(--info))',
    'hsl(var(--primary))',
    'hsl(var(--muted))',
  ];

  const handleSpotlightClick = () => {
    setIsModalOpen(true);
    setLoading(true);
    try {
      // Use hardcoded data from radarData
      const allAssetsData = getAssetImpactsFromRadarData();
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

  // Filter and sort data based on spotlight filters
  const filteredAndSortedData = useMemo(() => {
    if (!allData.length) return [];

    let sorted = [...allData];

    // Sort data
    switch (spotlightFilters.sortBy) {
      case 'countDesc':
        sorted.sort((a, b) => b.count - a.count);
        break;
      case 'countAsc':
        sorted.sort((a, b) => a.count - b.count);
        break;
    }

    // Limit results
    if (spotlightFilters.showTop !== 'all') {
      const limit = parseInt(spotlightFilters.showTop);
      sorted = sorted.slice(0, limit);
    }

    return sorted;
  }, [allData, spotlightFilters]);

  return (
    <>
      <div className="flex flex-col h-full relative">
        <h3 className="text-sm font-semibold mb-2">Assets / Products Impacted</h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={previewData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => value.toString()}
              />
              <YAxis 
                type="category" 
                dataKey="asset" 
                stroke="hsl(var(--muted-foreground))" 
                width={130}
                tickLine={false}
                axisLine={false}
                tick={<CustomYAxisTick maxWidth={120} />}
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
                barSize={16}
              >
                {previewData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={barColors[index % barColors.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Spotlight Button */}
        <div className="absolute bottom-2 left-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSpotlightClick}
            className="bg-card/90 backdrop-blur-sm h-8 w-8"
            title="Open Spotlight View"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 [&>button]:z-10">
          <SpotlightLayout
            title="Assets / Products Impacted"
            filters={
              <div className="space-y-6">
                {/* Sort By */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Sort By</h3>
                  <RadioGroup
                    value={spotlightFilters.sortBy}
                    onValueChange={(value: 'countDesc' | 'countAsc') => {
                      setSpotlightFilters(prev => ({
                        ...prev,
                        sortBy: value
                      }));
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="countDesc" id="countDesc" />
                      <Label htmlFor="countDesc" className="text-sm cursor-pointer">Count (High to Low)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="countAsc" id="countAsc" />
                      <Label htmlFor="countAsc" className="text-sm cursor-pointer">Count (Low to High)</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Show Top */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Show Top</h3>
                  <RadioGroup
                    value={spotlightFilters.showTop}
                    onValueChange={(value: '5' | '10' | '20' | 'all') => {
                      setSpotlightFilters(prev => ({
                        ...prev,
                        showTop: value
                      }));
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="top5" />
                      <Label htmlFor="top5" className="text-sm cursor-pointer">5</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="10" id="top10" />
                      <Label htmlFor="top10" className="text-sm cursor-pointer">10</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="20" id="top20" />
                      <Label htmlFor="top20" className="text-sm cursor-pointer">20</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="topAll" />
                      <Label htmlFor="topAll" className="text-sm cursor-pointer">All</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            }
          >
            <ScrollArea className="w-full h-full">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : filteredAndSortedData.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No asset data available</p>
                </div>
              ) : (
                <div className="w-full p-6" style={{ minWidth: '600px' }}>
                  <ResponsiveContainer width="100%" height={Math.max(400, filteredAndSortedData.length * 40)}>
                    <BarChart data={filteredAndSortedData} layout="vertical" margin={{ left: 10, right: 30, top: 20, bottom: 20 }}>
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
                        tickLine={false}
                        axisLine={false}
                        width={180}
                        tick={<CustomYAxisTick maxWidth={170} />}
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
                        barSize={24}
                      >
                        {filteredAndSortedData.map((entry, index) => (
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
          </SpotlightLayout>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssetsChart;
