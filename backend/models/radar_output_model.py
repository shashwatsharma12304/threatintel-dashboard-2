# ============================================================
# Radar Output Models
# ============================================================

from enum import Enum
from datetime import datetime, date
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

# Import from sibling modules
from models.customer_model import RadarOwningTeam
from models.threat_news_response_model import ThreatSeverity

class ThreatStatus(str, Enum):
    NEW = "new"
    ACTIVE = "active"
    MITIGATED = "mitigated"


class RadarThreatAsset(BaseModel):
    product_id: str
    product_name: str
    owning_team: RadarOwningTeam
    is_crown_jewel: bool
    internet_facing: bool
    data_sensitivity: Literal["low", "medium", "high"]


class RadarThreatPoint(BaseModel):
    id: str
    threat_name: str
    title: str
    severity: ThreatSeverity
    status: ThreatStatus

    severity_score: float
    relevance_score: float
    prioritization_score: float
    prioritization_band: Literal["critical", "high", "medium", "low"]

    primary_surface: RadarOwningTeam
    theta_deg: float
    radius_norm: float

    assets_impacted: List[RadarThreatAsset]
    cve_ids: List[str]
    mitre_tactics: List[str]
    mitre_techniques: List[str]
    source: str
    source_link: str
    first_seen: date
    last_updated: date
    summary: str
    relevance_reasons: List[str]
    industries_affected: List[str]
    regions_or_countries_targeted: List[str]


class TimeRange(str, Enum):
    LAST_24H = "last_24h"
    LAST_7D = "last_7d"
    LAST_30D = "last_30d"


class ThreatRadarFilters(BaseModel):
    query: Optional[str] = None
    severities: List[ThreatSeverity] = Field(default_factory=list)
    statuses: List[ThreatStatus] = Field(default_factory=list)
    time_range: TimeRange = TimeRange.LAST_7D
    asset_ids: List[str] = Field(default_factory=list)


class ThreatRadarMeta(BaseModel):
    generated_at: datetime
    customer_id: str
    total_threats: int


class ThreatIntelRadarResponse(BaseModel):
    meta: ThreatRadarMeta
    points: List[RadarThreatPoint]
    # Note: filters removed - frontend will apply filters client-side based on point attributes