from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- Node Models ---

class ThreatNode(BaseModel):
    """Represents a Threat Actor node."""
    id: str
    type: Literal["threat"]
    from_file: str = Field(alias="from") 

class BreachNode(BaseModel):
    """Represents a Security Breach event node."""
    id: str
    type: Literal["breach"]
    from_file: str = Field(alias="from")

class ProductNode(BaseModel):
    """Represents a Product/Technology node."""
    id: str
    type: Literal["product"]
    from_file: str = Field(alias="from")
    cves: Optional[List[str]] = None

Node = ThreatNode | BreachNode | ProductNode

# --- Edge Models ---

class BaseEdge(BaseModel):
    """Base model for all graph edges."""
    source: str
    target: str
    criteria: str
    reasoning: str
    confidence: Literal["low", "medium", "high"]


class Nodes(BaseModel):
    """Container for all different node types."""
    threats: List[ThreatNode]
    breaches: List[BreachNode]
    products: List[ProductNode]

class Edges(BaseModel):
    """Container for all different edge types."""
    threat_to_breach: List[ThreatToBreachEdge]
    threat_to_product: List[ThreatToProductEdge]

class Metadata(BaseModel):
    """Represents the metadata block of the JSON."""
    scope: str
    source_pdfs: List[str]
    note: str

class ThreatGraph(BaseModel):
    """The complete Pydantic model for the entire JSON structure."""
    metadata: Metadata
    nodes: Nodes
    edges: Edges
