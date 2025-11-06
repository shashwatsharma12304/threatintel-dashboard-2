import { Threat, FilterState, KpiData, ActivityDataPoint, AssetImpact } from '@/types/threat';
import { mockThreats, mockActivityData, mockAssetImpacts } from './mockData';

// In-memory store
let threats = [...mockThreats];
let updateListeners: (() => void)[] = [];

// Subscribe to updates (for polling/SSE simulation)
export function subscribeToUpdates(callback: () => void) {
  updateListeners.push(callback);
  return () => {
    updateListeners = updateListeners.filter(cb => cb !== callback);
  };
}

// Simulate live updates every 10 seconds
setInterval(() => {
  // Randomly update a threat status or add a new one
  if (Math.random() > 0.7) {
    const randomIndex = Math.floor(Math.random() * threats.length);
    const statuses: Threat['status'][] = ['New', 'Active', 'Mitigated'];
    threats[randomIndex] = {
      ...threats[randomIndex],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      last_updated: new Date().toISOString(),
    };
    updateListeners.forEach(cb => cb());
  }
}, 10000);

// Filter threats based on filter state
function filterThreats(filters: FilterState): Threat[] {
  return threats.filter(threat => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        threat.name.toLowerCase().includes(searchLower) ||
        threat.asset.toLowerCase().includes(searchLower) ||
        threat.source.toLowerCase().includes(searchLower) ||
        threat.cves?.some(cve => cve.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Severity filter
    if (filters.severity.length > 0 && !filters.severity.includes(threat.severity)) {
      return false;
    }

    // Asset filter
    if (filters.assets.length > 0 && !filters.assets.includes(threat.asset)) {
      return false;
    }

    // Source filter
    if (filters.sources.length > 0 && !filters.sources.includes(threat.source)) {
      return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(threat.status)) {
      return false;
    }

    // Time range filter
    const threatDate = new Date(threat.first_seen);
    const now = new Date();
    const daysDiff = (now.getTime() - threatDate.getTime()) / (1000 * 60 * 60 * 24);
    
    switch (filters.timeRange) {
      case 'last24h':
        if (daysDiff > 1) return false;
        break;
      case 'last7d':
        if (daysDiff > 7) return false;
        break;
      case 'last30d':
        if (daysDiff > 30) return false;
        break;
    }

    return true;
  });
}

// GET /api/threats
export async function getThreats(filters: FilterState): Promise<Threat[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return filterThreats(filters);
}

// GET /api/threats/:id
export async function getThreatById(id: string): Promise<Threat | null> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return threats.find(t => t.id === id) || null;
}

// POST /api/actions
export async function executeAction(threatId: string, actionType: string, payload?: any): Promise<{ ok: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Action executed:', { threatId, actionType, payload });
  return { ok: true, message: `Action "${actionType}" executed successfully for threat ${threatId}` };
}

// Calculate KPIs
export function calculateKpis(filteredThreats: Threat[]): KpiData {
  const active = filteredThreats.filter(t => t.status === 'Active' || t.status === 'New').length;
  const critical = filteredThreats.filter(t => t.severity === 'Critical' && t.status !== 'Mitigated').length;
  const high = filteredThreats.filter(t => t.severity === 'High' && t.status !== 'Mitigated').length;
  
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const newLast24h = filteredThreats.filter(t => new Date(t.first_seen) > oneDayAgo).length;
  
  const uniqueAssets = new Set(filteredThreats.map(t => t.asset));
  const assetsImpacted = uniqueAssets.size;

  return { active, critical, high, newLast24h, assetsImpacted };
}

// Get activity data
export function getActivityData(): ActivityDataPoint[] {
  return mockActivityData;
}

// Get asset impacts
export function getAssetImpacts(filteredThreats: Threat[]): AssetImpact[] {
  const assetCounts = new Map<string, number>();
  filteredThreats
    .filter(t => t.status !== 'Mitigated')
    .forEach(t => {
      assetCounts.set(t.asset, (assetCounts.get(t.asset) || 0) + 1);
    });
  
  return Array.from(assetCounts.entries())
    .map(([asset, count]) => ({ asset, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// Get unique values for filters
export function getUniqueAssets(): string[] {
  return Array.from(new Set(threats.map(t => t.asset))).sort();
}

export function getUniqueSources(): string[] {
  return Array.from(new Set(threats.map(t => t.source))).sort();
}
