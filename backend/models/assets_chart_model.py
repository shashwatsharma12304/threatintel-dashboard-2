# ============================================================
# Assets Chart Models
# ============================================================
"""
Pydantic models for the assets chart.
Defines the data structure for visualizing asset-level threat counts.
Used as the output schema for the assets chart generation pipeline.
"""

from typing import List
from pydantic import BaseModel, Field

class AssetImpact(BaseModel):
    """
    Represents an asset entry in the assets chart.
    Each instance provides the identifier for an asset and its associated threat count.

    Attributes:
        asset (str): Unique identifier or name for the asset (e.g., 'webserver-prod-1', 'database01').
        count (int): Number of distinct threats or events associated with this asset.
    """
    asset: str = Field(..., description="Unique identifier or name for the asset (e.g., host, service, application).")
    count: int = Field(..., description="Number of threats or risk events affecting this asset.")


class AssetsChartResponse(BaseModel):
    """
    Full list of asset impact entries for the assets chart.
    Used as the API/model output for consumers of assets chart data.

    Attributes:
        assets (List[AssetImpact]): List of impact entries, typically sorted by descending threat count.
    """
    assets: List[AssetImpact] = Field(..., description="List of asset entries with their threat/risk impact counts.")
