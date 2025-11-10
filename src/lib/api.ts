import { Threat, FilterState, KpiData, ActivityDataPoint, AssetImpact } from '@/types/threat';
import { API_BASE_URL } from './config';

// Subscribe to updates (for polling)
let updateListeners: (() => void)[] = [];

export function subscribeToUpdates(callback: () => void) {
  updateListeners.push(callback);
  
  // Poll every 10 seconds
  const interval = setInterval(async () => {
    try {
      // Just trigger a refresh - components will refetch
      updateListeners.forEach(cb => cb());
    } catch (error) {
      console.error('Error in update polling:', error);
    }
  }, 10000);
  
  return () => {
    clearInterval(interval);
    updateListeners = updateListeners.filter(cb => cb !== callback);
  };
}

// Helper to build query string from filters
function buildQueryString(filters: FilterState, customerId?: string): string {
  const params = new URLSearchParams();
  
  if (customerId) {
    params.append('customer_id', customerId);
  }
  
  if (filters.search) {
    params.append('search', filters.search);
  }
  
  filters.severity.forEach(sev => params.append('severity', sev));
  filters.statuses.forEach(status => params.append('status', status));
  filters.assets.forEach(asset => params.append('assets', asset));
  filters.sources.forEach(source => params.append('sources', source));
  
  if (filters.timeRange && filters.timeRange !== 'custom') {
    params.append('timeRange', filters.timeRange);
  }
  
  return params.toString();
}

// GET /api/threats
export async function getThreats(filters: FilterState, customerId?: string): Promise<Threat[]> {
  try {
    const queryString = buildQueryString(filters, customerId);
    const response = await fetch(`${API_BASE_URL}/threats?${queryString}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch threats: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching threats:', error);
    return [];
  }
}

// GET /api/threats/:id (not implemented in API yet, but keeping for compatibility)
export async function getThreatById(id: string): Promise<Threat | null> {
  try {
    // For now, fetch all threats and find by ID
    const threats = await getThreats({ 
      search: '', 
      severity: [], 
      assets: [], 
      sources: [], 
      statuses: [], 
      tags: [], 
      timeRange: 'last30d' 
    });
    return threats.find(t => t.id === id) || null;
  } catch (error) {
    console.error('Error fetching threat by ID:', error);
    return null;
  }
}

// POST /api/actions (stub - not implemented in API yet)
export async function executeAction(threatId: string, actionType: string, payload?: any): Promise<{ ok: boolean; message: string }> {
  // Stub implementation - would call API endpoint if implemented
  console.log('Action executed:', { threatId, actionType, payload });
  return { ok: true, message: `Action "${actionType}" executed successfully for threat ${threatId}` };
}

// GET /api/kpis
export async function calculateKpis(customerId?: string): Promise<KpiData> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/kpis?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return { active: 0, critical: 0, high: 0, newLast24h: 0, assetsImpacted: 0 };
  }
}

// GET /api/activity-chart
export async function getActivityData(customerId?: string): Promise<ActivityDataPoint[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/activity-chart?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch activity data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return [];
  }
}

// GET /api/activity-chart/all
export async function getAllActivityData(customerId?: string): Promise<ActivityDataPoint[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/activity-chart/all?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all activity data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching all activity data:', error);
    return [];
  }
}

// GET /api/assets-chart
export async function getAssetImpacts(customerId?: string): Promise<AssetImpact[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/assets-chart?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch asset impacts: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching asset impacts:', error);
    return [];
  }
}

// GET /api/assets-chart/all
export async function getAllAssetImpacts(customerId?: string): Promise<AssetImpact[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/assets-chart/all?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all asset impacts: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching all asset impacts:', error);
    return [];
  }
}

// GET /api/filter-options
export async function getUniqueAssets(customerId?: string): Promise<string[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/filter-options?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch filter options: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.assets || [];
  } catch (error) {
    console.error('Error fetching unique assets:', error);
    return [];
  }
}

export async function getUniqueSources(customerId?: string): Promise<string[]> {
  try {
    const params = new URLSearchParams();
    if (customerId) {
      params.append('customer_id', customerId);
    }
    
    const response = await fetch(`${API_BASE_URL}/filter-options?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch filter options: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.sources || [];
  } catch (error) {
    console.error('Error fetching unique sources:', error);
    return [];
  }
}
