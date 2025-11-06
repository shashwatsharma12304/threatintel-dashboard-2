import { useState, useEffect, useMemo } from 'react';
import { Threat, FilterState, SeverityLevel } from '@/types/threat';
import { 
  getThreats, 
  subscribeToUpdates, 
  calculateKpis, 
  getActivityData, 
  getAssetImpacts,
  getUniqueAssets,
  getUniqueSources,
} from '@/lib/api';
import KpiCards from '@/components/KpiCards';
import FiltersSidebar from '@/components/FiltersSidebar';
import RadarCanvas from '@/components/RadarCanvas';
import ActivityChart from '@/components/ActivityChart';
import AssetsChart from '@/components/AssetsChart';
import ThreatDetailsPanel from '@/components/ThreatDetailsPanel';
import ActModal from '@/components/ActModal';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { Menu, BarChart2 } from 'lucide-react';

const Index = () => {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
  const [actModalOpen, setActModalOpen] = useState(false);
  const [actModalThreat, setActModalThreat] = useState<Threat | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: [],
    assets: [],
    sources: [],
    statuses: ['New', 'Active'],
    tags: [],
    timeRange: 'last30d',
  });

  // Fetch threats
  useEffect(() => {
    const loadThreats = async () => {
      setLoading(true);
      const data = await getThreats(filters);
      setThreats(data);
      setLoading(false);
    };
    loadThreats();
  }, [filters]);

  // Subscribe to live updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      getThreats(filters).then(setThreats);
    });
    return unsubscribe;
  }, [filters]);

  // Calculate derived data
  const kpis = useMemo(() => calculateKpis(threats), [threats]);
  const activityData = useMemo(() => getActivityData(), []);
  const assetImpacts = useMemo(() => getAssetImpacts(threats), [threats]);
  const availableAssets = useMemo(() => getUniqueAssets(), []);
  const availableSources = useMemo(() => getUniqueSources(), []);

  const handleThreatClick = (threatId: string, multiSelect: boolean) => {
    // Single selection - clicking a threat selects it and opens the details panel
    setSelectedThreatId(prev => prev === threatId ? null : threatId);
  };

  const handleCloseDetailsPanel = () => {
    setSelectedThreatId(null);
  };

  const handleOpenActModal = (threat: Threat) => {
    setActModalThreat(threat);
    setActModalOpen(true);
  };

  const handleCloseActModal = () => {
    setActModalOpen(false);
    setActModalThreat(null);
  };

  const selectedThreat = useMemo(() => {
    return selectedThreatId ? threats.find(t => t.id === selectedThreatId) || null : null;
  }, [selectedThreatId, threats]);
  
  const handleAssetClick = (asset: string) => {
    setFilters(prev => ({
      ...prev,
      assets: prev.assets.includes(asset) ? prev.assets.filter(a => a !== asset) : [...prev.assets, asset]
    }));
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden">
      {/* Collapsible Sidebar */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0'}`}>
        <FiltersSidebar
            filters={filters}
            onFiltersChange={setFilters}
            availableAssets={availableAssets}
            availableSources={availableSources}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Threat Intelligence Dashboard</h1>
              <p className="text-sm text-muted-foreground">Real-time threat intelligence overview</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <KpiCards data={kpis} />
          
          <div className="grid grid-cols-3 gap-4 h-[calc(100%-120px)] relative">
            {/* Radar takes 2/3 width */}
            <div className="col-span-2 bg-black rounded-lg flex items-center justify-center p-4 card-shadow">
              <RadarCanvas
                threats={threats}
                selectedThreatIds={selectedThreatId ? [selectedThreatId] : []}
                onThreatClick={handleThreatClick}
                activeSeverityFilter='All'
                onSeverityFilterChange={() => {}}
              />
            </div>

            {/* Charts take 1/3 width */}
            <div className="col-span-1 flex flex-col gap-4">
              <div className="flex-1 bg-card rounded-lg p-4 card-shadow">
                <ActivityChart data={activityData} />
              </div>
              <div className="flex-1 bg-card rounded-lg p-4 card-shadow">
                <AssetsChart data={assetImpacts} onAssetClick={handleAssetClick} />
              </div>
            </div>

            {/* Threat Details Panel - slides in from right */}
            {selectedThreat && (
              <div className="absolute right-0 top-0 bottom-0 flex items-center z-50">
                <ThreatDetailsPanel
                  threat={selectedThreat}
                  onClose={handleCloseDetailsPanel}
                  onOpenActModal={handleOpenActModal}
                />
              </div>
            )}
          </div>

          {/* Act Modal */}
          <ActModal
            threat={actModalThreat}
            open={actModalOpen}
            onClose={handleCloseActModal}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
