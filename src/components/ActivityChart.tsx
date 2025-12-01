import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ActivityDataPoint, SeverityLevel } from '@/types/threat';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getActivityDataFromRadarData } from '@/lib/radarData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SpotlightLayout from '@/components/SpotlightLayout';

interface ActivityChartProps {
  data: ActivityDataPoint[];
}

const ActivityChart = ({ data }: ActivityChartProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allData, setAllData] = useState<ActivityDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Spotlight-specific filters
  const [spotlightFilters, setSpotlightFilters] = useState({
    severities: {
      Critical: true,
      High: true,
      Medium: true,
      Low: true,
    },
    dateRange: 'all' as 'last7d' | 'last30d' | 'last90d' | 'all',
  });

  // Reset spotlight filters when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setSpotlightFilters({
        severities: {
          Critical: true,
          High: true,
          Medium: true,
          Low: true,
        },
        dateRange: 'all',
      });
    }
  }, [isModalOpen]);

  const handleChartClick = () => {
    setIsModalOpen(true);
    setLoading(true);
    try {
      // Use hardcoded data from radarData
      const allActivityData = getActivityDataFromRadarData();
      setAllData(allActivityData);
    } catch (error) {
      console.error('Error fetching all activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on spotlight filters
  const filteredData = useMemo(() => {
    if (!allData.length) return [];

    // Filter by date range
    let filtered = [...allData];
    if (spotlightFilters.dateRange !== 'all') {
      const now = new Date();
      const days = spotlightFilters.dateRange === 'last7d' ? 7 
                 : spotlightFilters.dateRange === 'last30d' ? 30 
                 : 90;
      const cutoffDate = new Date(now.setDate(now.getDate() - days));
      filtered = filtered.filter(item => new Date(item.date) >= cutoffDate);
    }

    return filtered;
  }, [allData, spotlightFilters.dateRange]);

  return (
    <>
      <div className="flex flex-col h-full relative">
        <h3 className="text-sm font-semibold mb-2">Activity Diagnostics</h3>
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
        
        {/* Spotlight Button */}
        <div className="absolute bottom-2 left-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleChartClick}
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
            title="Activity Diagnostics"
            filters={
              <div className="space-y-6">
                {/* Severity Toggles */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Show Severity</h3>
                  <div className="space-y-2">
                    {Object.keys(spotlightFilters.severities).map((severity) => (
                      <div key={severity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`activity-${severity}`}
                          checked={spotlightFilters.severities[severity as keyof typeof spotlightFilters.severities]}
                          onCheckedChange={(checked) => {
                            setSpotlightFilters(prev => ({
                              ...prev,
                              severities: {
                                ...prev.severities,
                                [severity]: !!checked
                              }
                            }));
                          }}
                        />
                        <Label htmlFor={`activity-${severity}`} className="text-sm cursor-pointer">
                          {severity}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Date Range</h3>
                  <RadioGroup
                    value={spotlightFilters.dateRange}
                    onValueChange={(value: 'last7d' | 'last30d' | 'last90d' | 'all') => {
                      setSpotlightFilters(prev => ({
                        ...prev,
                        dateRange: value
                      }));
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="last7d" id="last7d" />
                      <Label htmlFor="last7d" className="text-sm cursor-pointer">Last 7 days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="last30d" id="last30d" />
                      <Label htmlFor="last30d" className="text-sm cursor-pointer">Last 30 days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="last90d" id="last90d" />
                      <Label htmlFor="last90d" className="text-sm cursor-pointer">Last 90 days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="text-sm cursor-pointer">All</Label>
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
              ) : filteredData.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No activity data available</p>
                </div>
              ) : (
                <div className="w-full p-6" style={{ minWidth: '800px' }}>
                  <ResponsiveContainer width="100%" height={Math.max(400, filteredData.length * 40)}>
                    <BarChart data={filteredData} layout="vertical" margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
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
                      {spotlightFilters.severities.Critical && <Bar dataKey="Critical" stackId="a" fill="hsl(var(--danger))" radius={[0, 4, 4, 0]} />}
                      {spotlightFilters.severities.High && <Bar dataKey="High" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />}
                      {spotlightFilters.severities.Medium && <Bar dataKey="Medium" stackId="a" fill="hsl(var(--info))" radius={[0, 0, 0, 0]} />}
                      {spotlightFilters.severities.Low && <Bar dataKey="Low" stackId="a" fill="hsl(var(--muted))" radius={[0, 0, 0, 0]} />}
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

export default ActivityChart;
