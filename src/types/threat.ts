// MongoDB schema-compatible types
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type StatusType = 'new' | 'active' | 'mitigated';

export interface RadarThreatAsset {
  product_id: string;
  product_name: string;
  owning_team: string;
  is_crown_jewel: boolean;
  internet_facing: boolean;
  data_sensitivity: 'low' | 'medium' | 'high';
}

export interface Threat {
  // MongoDB RadarThreatPoint schema
  id: string;
  threat_name: string;
  title: string;
  severity: SeverityLevel;
  status: StatusType;
  severity_score: number;
  relevance_score: number;
  prioritization_score: number;
  prioritization_band: 'critical' | 'high' | 'medium' | 'low';
  primary_surface: string;
  theta_deg: number;
  radius_norm: number;
  assets_impacted: RadarThreatAsset[];
  cve_ids: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  source: string;
  source_link: string;
  first_seen: string;
  last_updated: string;
  summary: string;
  relevance_reasons: string[];
  industries_affected: string[];
  regions_or_countries_targeted: string[];
}

export interface FilterState {
  search: string;
  severity: SeverityLevel[];  // Now lowercase: 'critical', 'high', etc.
  assets: string[];
  sources: string[];
  statuses: StatusType[];  // Now lowercase: 'new', 'active', 'mitigated'
  tags: string[];
  timeRange: 'last24h' | 'last7d' | 'last30d' | 'custom';
}

export interface KpiData {
  active: number;
  critical: number;
  high: number;
  newLast24h: number;
  assetsImpacted: number;
}

export interface ActivityDataPoint {
  date: string;
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
}

export interface AssetImpact {
  asset: string;
  count: number;
}
