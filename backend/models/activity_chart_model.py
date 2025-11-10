# ============================================================
# Activity Chart Models
# ============================================================
"""
Pydantic models for the activity chart.
Defines the data structure for visualizing threat activity by date and severity.
Used as the output schema for the activity chart generation pipeline.
"""

from typing import List
from pydantic import BaseModel, Field

class ActivityDataPoint(BaseModel):
    """
    Represents a single day's threat activity for the activity chart.
    Each instance provides the number of threats for each severity on a specific date.

    Attributes:
        date (str): ISO8601 date ("YYYY-MM-DD") corresponding to this data point.
        Critical (int): Number of 'Critical' severity threats published on this date.
        High (int): Number of 'High' severity threats published on this date.
        Medium (int): Number of 'Medium' severity threats published on this date.
        Low (int): Number of 'Low' severity threats published on this date.
    """
    date: str = Field(..., description="ISO date (YYYY-MM-DD) of this activity data point")
    Critical: int = Field(0, description="Count of critical severity threats for this day")
    High: int = Field(0, description="Count of high severity threats for this day")
    Medium: int = Field(0, description="Count of medium severity threats for this day")
    Low: int = Field(0, description="Count of low severity threats for this day")


class ActivityChartResponse(BaseModel):
    """
    Full activity chart series for all dates and severities.
    Used as the API/model output for consumers of activity chart data.

    Attributes:
        data_points (List[ActivityDataPoint]): List of activity data points (typically sorted by date).
    """
    data_points: List[ActivityDataPoint] = Field(..., description="Series of activity chart data points by date")

