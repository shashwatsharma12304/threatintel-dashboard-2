import { Threat, ActivityDataPoint, AssetImpact } from '@/types/threat';
import radarDataJson from '../../backend/data/output/radar_cust-airtel-001_20251107_091437.json';

// Radar data from backend/data/output/radar_cust-airtel-001_20251107_091437.json
export const radarData = radarDataJson as {
  meta: {
    generated_at: string;
    customer_id: string;
    total_threats: number;
  };
  points: Threat[];
  activity_chart: ActivityDataPoint[];
  assets_chart: AssetImpact[];
};

// Calculate KPIs from the data
export const calculateKpisFromRadarData = () => {
  const threats = radarData.points;
  
  const active = threats.filter(t => t.status === 'active').length;
  const critical = threats.filter(t => t.severity === 'critical' && ['new', 'active'].includes(t.status)).length;
  const high = threats.filter(t => t.severity === 'high' && ['new', 'active'].includes(t.status)).length;
  
  // Calculate new threats in last 24 hours
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const newLast24h = threats.filter(t => {
    const firstSeen = new Date(t.first_seen);
    return firstSeen >= last24h && t.status === 'new';
  }).length;
  
  // Calculate unique assets impacted
  const uniqueAssets = new Set<string>();
  threats.forEach(t => {
    t.assets_impacted.forEach(asset => {
      uniqueAssets.add(asset.product_id);
    });
  });
  
  return {
    active,
    critical,
    high,
    newLast24h,
    assetsImpacted: uniqueAssets.size
  };
};

export const getThreatsFromRadarData = (): Threat[] => {
  return radarData.points;
};

export const getActivityDataFromRadarData = (): ActivityDataPoint[] => {
  return radarData.activity_chart;
};

export const getAssetImpactsFromRadarData = (): AssetImpact[] => {
  return radarData.assets_chart;
};

export const getUniqueAssetsFromRadarData = (): string[] => {
  const assets = new Set<string>();
  radarData.points.forEach(threat => {
    threat.assets_impacted.forEach(asset => {
      assets.add(asset.product_name);
    });
  });
  return Array.from(assets).sort();
};

export const getUniqueSourcesFromRadarData = (): string[] => {
  const sources = new Set<string>();
  radarData.points.forEach(threat => {
    if (threat.source) {
      sources.add(threat.source);
    }
  });
  return Array.from(sources).sort();
};

