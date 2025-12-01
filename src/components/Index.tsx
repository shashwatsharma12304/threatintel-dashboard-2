'use client';

import { useState, useEffect, useMemo } from 'react';
import { Threat, FilterState, SeverityLevel, ActivityDataPoint, AssetImpact } from '@/types/threat';
import { 
  getThreats, 
  subscribeToUpdates, 
  calculateKpis, 
  getActivityData, 
  getAssetImpacts,
  getUniqueAssets,
  getUniqueSources,
} from '@/lib/api';
import {
  getThreatsFromRadarData,
  calculateKpisFromRadarData,
  getActivityDataFromRadarData,
  getAssetImpactsFromRadarData,
  getUniqueAssetsFromRadarData,
  getUniqueSourcesFromRadarData,
} from '@/lib/radarData';
import KpiCards from '@/components/KpiCards';
import FiltersSidebar from '@/components/FiltersSidebar';
import RadarCanvas from '@/components/RadarCanvas';
import ActivityChart from '@/components/ActivityChart';
import AssetsChart from '@/components/AssetsChart';
import ThreatDetailsPanel from '@/components/ThreatDetailsPanel';
import ActModal from '@/components/ActModal';
import NotificationsPanel from '@/components/NotificationsPanel';
import CriticalAlertBar from '@/components/CriticalAlertBar';
import KpiThreatsModal from '@/components/KpiThreatsModal';
import NetworkGraph from '@/components/NetworkGraph';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { Menu, BarChart2 } from 'lucide-react';

const Index = () => {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
  const [highlightedThreatId, setHighlightedThreatId] = useState<string | null>(null);
  const [actModalOpen, setActModalOpen] = useState(false);
  const [actModalThreat, setActModalThreat] = useState<Threat | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiModalTitle, setKpiModalTitle] = useState('');
  const [kpiModalThreats, setKpiModalThreats] = useState<Threat[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: [],
    assets: [],
    sources: [],
    statuses: ['new', 'active'],  // Lowercase to match MongoDB schema
    tags: [],
    timeRange: 'last30d',
  });
  
  const [kpis, setKpis] = useState({ active: 0, critical: 0, high: 0, newLast24h: 0, assetsImpacted: 0 });
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [assetImpacts, setAssetImpacts] = useState<AssetImpact[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Fetch all data - using hardcoded radar data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Use hardcoded radar data
        const threatsData = getThreatsFromRadarData();
        const kpisData = calculateKpisFromRadarData();
        const activityDataData = getActivityDataFromRadarData();
        const assetImpactsData = getAssetImpactsFromRadarData();
        const assetsData = getUniqueAssetsFromRadarData();
        const sourcesData = getUniqueSourcesFromRadarData();
        
        setThreats(threatsData);
        setKpis(kpisData);
        setActivityData(activityDataData);
        setAssetImpacts(assetImpactsData);
        setAvailableAssets(assetsData);
        setAvailableSources(sourcesData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters]);

  // Subscribe to live updates - disabled for hardcoded data
  useEffect(() => {
    // Using hardcoded data, no live updates needed
    // const unsubscribe = subscribeToUpdates(async () => {
    //   const threatsData = getThreatsFromRadarData();
    //   const kpisData = calculateKpisFromRadarData();
    //   const activityDataData = getActivityDataFromRadarData();
    //   const assetImpactsData = getAssetImpactsFromRadarData();
    //   setThreats(threatsData);
    //   setKpis(kpisData);
    //   setActivityData(activityDataData);
    //   setAssetImpacts(assetImpactsData);
    // });
    // return unsubscribe;
  }, [filters]);

  // Update time on client side only to avoid hydration mismatch
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleThreatClick = (threatId: string, multiSelect: boolean) => {
    // Single selection - clicking a threat selects it and opens the details panel
    const isTogglingOff = selectedThreatId === threatId;
    setSelectedThreatId(isTogglingOff ? null : threatId);
    setHighlightedThreatId(isTogglingOff ? null : threatId);
  };

  const handleCloseDetailsPanel = () => {
    setSelectedThreatId(null);
    setHighlightedThreatId(null);
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

  const handleKpiCardClick = (cardType: 'active' | 'critical' | 'high' | 'new24h', cardThreats: Threat[]) => {
    const titles: Record<typeof cardType, string> = {
      active: 'Active Threats',
      critical: 'Critical Open Threats',
      high: 'High Severity Threats',
      new24h: 'New Threats (Last 24h)',
    };
    setKpiModalTitle(titles[cardType]);
    setKpiModalThreats(cardThreats);
    setKpiModalOpen(true);
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
        {/* Pre-Header Alert Bar */}
        <CriticalAlertBar criticalThreats={threats} />
        
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
          <div className="flex items-center gap-4">
            <NotificationsPanel 
              criticalThreats={threats} 
              onThreatClick={(threatId) => handleThreatClick(threatId, false)}
            />
            <ThemeToggle />
            <div className="text-sm text-muted-foreground">
              Last updated: {currentTime || '--:--:--'}
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="flex-1 p-4 overflow-hidden flex gap-4">
          {/* Left: Main visualization area */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Top: Radar and Network - 65% */}
            <div className="flex-[65] grid grid-cols-2 gap-4 min-h-0">
              {/* Radar Visualization - 50% width */}
              <div className="bg-card rounded-lg p-4 card-shadow overflow-hidden">
                <div className="w-full h-full">
                  <RadarCanvas
                    threats={threats}
                    selectedThreatIds={selectedThreatId ? [selectedThreatId] : []}
                    onThreatClick={handleThreatClick}
                    activeSeverityFilter='All'
                    onSeverityFilterChange={() => {}}
                  />
                </div>
              </div>

              {/* Network Graph - 50% width */}
              <div className="bg-card rounded-lg p-4 card-shadow overflow-hidden">
                <div className="w-full h-full">
                  <NetworkGraph 
                    threats={threats}
                    highlightedThreatId={highlightedThreatId}
                    onNodeClick={(nodeId, nodeType) => {
                      if (nodeType === 'threat') {
                        handleThreatClick(nodeId, false);
                      }
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Bottom: Activity and Assets - 35% */}
            <div className="flex-[35] grid grid-cols-2 gap-4 min-h-0">
              {/* Activity Chart */}
              <div className="bg-card rounded-lg p-4 card-shadow overflow-hidden">
                <div className="w-full h-full">
                  <ActivityChart data={activityData} />
                </div>
              </div>

              {/* Assets Chart */}
              <div className="bg-card rounded-lg p-4 card-shadow overflow-hidden">
                <div className="w-full h-full">
                  <AssetsChart data={assetImpacts} onAssetClick={handleAssetClick} />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Vertical KPI sidebar */}
          <div className="w-44 lg:w-48 xl:w-52 shrink-0">
            <div className="h-full bg-card rounded-lg p-4 card-shadow">
              <KpiCards 
                data={kpis} 
                threats={threats}
                onCardClick={handleKpiCardClick}
              />
            </div>
          </div>

          {/* Act Modal */}
          <ActModal
            threat={actModalThreat}
            open={actModalOpen}
            onClose={handleCloseActModal}
          />

          {/* KPI Threats Modal */}
          <KpiThreatsModal
            open={kpiModalOpen}
            onClose={() => setKpiModalOpen(false)}
            title={kpiModalTitle}
            threats={kpiModalThreats}
            onThreatClick={(threatId) => {
              handleThreatClick(threatId, false);
              setKpiModalOpen(false);
            }}
          />
        </main>
      </div>

      {/* Right Sidebar - Threat Details Panel */}
      <div className={`transition-all duration-300 h-full ${selectedThreat ? 'w-96' : 'w-0'} overflow-hidden`}>
        {selectedThreat && (
          <ThreatDetailsPanel
            threat={selectedThreat}
            onClose={handleCloseDetailsPanel}
            onOpenActModal={handleOpenActModal}
          />
        )}
      </div>
    </div>
  );
};

export default Index;


