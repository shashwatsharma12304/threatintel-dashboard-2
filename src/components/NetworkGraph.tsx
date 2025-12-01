'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Threat, SeverityLevel } from '@/types/threat';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SpotlightLayout from '@/components/SpotlightLayout';

interface NetworkGraphProps {
  threats?: Threat[];
  highlightedThreatId?: string | null;
  onNodeClick?: (nodeId: string, nodeType: 'threat' | 'asset') => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'threat' | 'asset';
  severity?: string;
  data?: any;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ threats = [], highlightedThreatId = null, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const modalSvgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Store zoom behavior and node positions for programmatic control
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesDataRef = useRef<GraphNode[]>([]);
  
  // Use ref to store callback to prevent unnecessary re-renders
  const onNodeClickRef = useRef(onNodeClick);
  
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Calculate 1st order connections for highlighted threat
  const getHighlightedNodes = (threatId: string | null, allNodes: GraphNode[], allLinks: GraphLink[]): Set<string> => {
    if (!threatId) return new Set();
    
    const highlightedNodes = new Set<string>();
    highlightedNodes.add(threatId); // Add the threat itself
    
    // Find all assets connected to this threat
    allLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === threatId) {
        highlightedNodes.add(targetId);
      } else if (targetId === threatId) {
        highlightedNodes.add(sourceId);
      }
    });
    
    return highlightedNodes;
  };

  // Spotlight-specific filters
  const [spotlightFilters, setSpotlightFilters] = useState({
    showThreats: true,
    showAssets: true,
    severities: ['critical', 'high', 'medium', 'low'] as SeverityLevel[],
  });

  // Reset spotlight filters when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setSpotlightFilters({
        showThreats: true,
        showAssets: true,
        severities: ['critical', 'high', 'medium', 'low'] as SeverityLevel[],
      });
    }
  }, [isModalOpen]);

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const { width, height } = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Track theme changes by observing DOM class changes
  useEffect(() => {
    // Initialize theme from DOM
    const getCurrentTheme = (): 'light' | 'dark' => {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    };
    
    setTheme(getCurrentTheme());

    // Watch for class changes on document.documentElement
    const observer = new MutationObserver(() => {
      const newTheme = getCurrentTheme();
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Function to render the graph on a given SVG element
  const renderGraph = (svgElement: SVGSVGElement, width: number, height: number, filters?: typeof spotlightFilters, highlightThreatId?: string | null, currentTheme?: string) => {
    if (!svgElement || width === 0 || threats.length === 0) return;

    // Use provided filters or default to showing everything
    const activeFilters = filters || { showThreats: true, showAssets: true, severities: ['critical', 'high', 'medium', 'low'] as SeverityLevel[] };

    // Clear previous graph
    d3.select(svgElement).selectAll('*').remove();

    // Filter threats based on severity
    const filteredThreats = threats.filter(threat => 
      activeFilters.severities.includes(threat.severity as SeverityLevel)
    );

    // Create nodes and links from threat data
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const assetMap = new Map<string, GraphNode>();

    // Create threat nodes with deterministic initial positions based on index
    // This ensures consistent layout on each render
    let nodeIndex = 0;
    const totalNodes = filteredThreats.length + filteredThreats.reduce((sum, t) => sum + t.assets_impacted.length, 0);
    const radius = Math.min(width, height) * 0.3;
    
    filteredThreats.forEach((threat, threatIndex) => {
      // Add threat node only if showThreats is true
      if (activeFilters.showThreats) {
        const angle = (nodeIndex / totalNodes) * 2 * Math.PI;
        nodes.push({
          id: threat.id,
          label: threat.threat_name,
          type: 'threat',
          severity: threat.severity,
          data: threat,
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
        });
        nodeIndex++;
      }

      // Create asset nodes and links
      threat.assets_impacted.forEach((asset) => {
        if (activeFilters.showAssets && !assetMap.has(asset.product_id)) {
          const assetAngle = (nodeIndex / totalNodes) * 2 * Math.PI;
          const assetNode: GraphNode = {
            id: asset.product_id,
            label: asset.product_name,
            type: 'asset',
            data: asset,
            x: width / 2 + Math.cos(assetAngle) * radius,
            y: height / 2 + Math.sin(assetAngle) * radius,
          };
          assetMap.set(asset.product_id, assetNode);
          nodes.push(assetNode);
          nodeIndex++;
        }

        // Only create link if both threat and asset nodes are shown
        if (activeFilters.showThreats && activeFilters.showAssets) {
          links.push({
            source: threat.id,
            target: asset.product_id,
          });
        }
      });
    });

    // Store nodes data for later access
    nodesDataRef.current = nodes;

    // Calculate highlighted nodes (threat + 1st order connections)
    const highlightedNodes = getHighlightedNodes(highlightThreatId || null, nodes, links);
    const hasHighlight = highlightedNodes.size > 0;

    // Set up SVG
    const svg = d3.select(svgElement);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    
    // Store zoom behavior for programmatic control (only for main view, not modal)
    if (svgElement === svgRef.current) {
      zoomBehaviorRef.current = zoom;
    }

    const g = svg.append('g');

    // Create links with theme-aware color
    // Use passed theme or fallback to checking DOM class
    const isDark = currentTheme ? currentTheme === 'dark' : document.documentElement.classList.contains('dark');
    const linkColor = isDark ? 'rgba(255,255,255,0.35)' : '#000000';
    const linkOpacity = isDark ? 0.75 : 0.6;
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        if (!hasHighlight) return linkColor;
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightedNodes.has(sourceId) && highlightedNodes.has(targetId);
        return isHighlighted ? (isDark ? '#00ff88' : '#1a5c3a') : linkColor;
      })
      .attr('stroke-opacity', (d) => {
        if (!hasHighlight) return linkOpacity;
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightedNodes.has(sourceId) && highlightedNodes.has(targetId);
        return isHighlighted ? 1.0 : 0.2;
      })
      .attr('stroke-width', (d) => {
        if (!hasHighlight) return isDark ? 2 : 1.5;
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightedNodes.has(sourceId) && highlightedNodes.has(targetId);
        return isHighlighted ? 3.5 : 1;
      })
      .style('filter', (d) => {
        if (!hasHighlight) return 'none';
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightedNodes.has(sourceId) && highlightedNodes.has(targetId);
        return isHighlighted ? 'drop-shadow(0 0 4px currentColor)' : 'none';
      });

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .style('opacity', (d) => {
        if (!hasHighlight) return 1;
        return highlightedNodes.has(d.id) ? 1 : 0.2;
      });

    // Add circles for nodes
    node.append('circle')
      .attr('r', (d) => {
        const baseRadius = d.type === 'threat' ? 8 : 6;
        if (!hasHighlight) return baseRadius;
        return highlightedNodes.has(d.id) ? baseRadius * 1.5 : baseRadius;
      })
      .attr('fill', d => {
        if (d.type === 'asset') return 'hsl(var(--info))';
        switch (d.severity) {
          case 'critical': return 'hsl(var(--danger))';
          case 'high': return 'hsl(var(--warning))';
          case 'medium': return 'hsl(var(--info))';
          case 'low': return 'hsl(var(--muted))';
          default: return 'hsl(var(--muted))';
        }
      })
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', (d) => {
        if (!hasHighlight) return 2;
        return highlightedNodes.has(d.id) ? 3 : 1;
      })
      .style('filter', (d) => {
        if (!hasHighlight || !highlightedNodes.has(d.id)) return 'none';
        // Apply glow effect to highlighted nodes
        return 'drop-shadow(0 0 8px currentColor) drop-shadow(0 0 12px currentColor)';
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onNodeClickRef.current) {
          onNodeClickRef.current(d.id, d.type);
        }
      });

    // Add labels
    node.append('text')
      .text(d => d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', 'hsl(var(--foreground))')
      .style('pointer-events', 'none');

    // Define updatePositions function BEFORE simulation and drag handlers
    const updatePositions = () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0);

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    };

    // Drag functions - defined before applying to nodes
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      d3.select(event.sourceEvent.target as Element).raise();
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
      event.subject.x = event.x;
      event.subject.y = event.y;
      updatePositions();
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    // Apply drag behavior after functions are defined
    node.call(d3.drag<SVGGElement, GraphNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended) as any);

    // Create force simulation - will run once to calculate positions synchronously
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))
      .alphaDecay(0.05)  // Balanced decay for proper convergence
      .velocityDecay(0.7)  // High damping to stop movement
      .alphaMin(0.001);  // Stop when stable

    // Run the simulation synchronously for a fixed number of iterations
    // This calculates the layout without any visible animation
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }
    
    // Stop the simulation completely - no more ticks
    simulation.stop();
    
    // Fix all node positions permanently so they never move
    nodes.forEach(node => {
      node.fx = node.x;
      node.fy = node.y;
    });
    
    // Update the visual positions one time with the final calculated layout
    updatePositions();

    return () => {
      simulation.stop();
    };
  };

  // Render main graph (onNodeClick removed from deps - using ref instead)
  useEffect(() => {
    if (svgRef.current && dimensions.width > 0) {
      // Use requestAnimationFrame to ensure DOM has updated with theme class
      requestAnimationFrame(() => {
        renderGraph(svgRef.current!, dimensions.width, dimensions.height, undefined, highlightedThreatId, theme);
      });
    }
  }, [threats, dimensions, highlightedThreatId, theme]);

  // Render modal graph (onNodeClick removed from deps - using ref instead)
  useEffect(() => {
    if (isModalOpen && modalSvgRef.current && modalSvgRef.current.parentElement) {
      const { width, height } = modalSvgRef.current.parentElement.getBoundingClientRect();
      // Use requestAnimationFrame to ensure DOM has updated with theme class
      requestAnimationFrame(() => {
        // Use the full available space with minimal padding
        renderGraph(modalSvgRef.current!, width - 100, height - 100, spotlightFilters, highlightedThreatId, theme);
      });
    }
  }, [isModalOpen, threats, spotlightFilters, highlightedThreatId, theme]);

  // Center on highlighted node when it changes
  useEffect(() => {
    if (highlightedThreatId && svgRef.current && zoomBehaviorRef.current && nodesDataRef.current.length > 0) {
      // Find the highlighted node
      const highlightedNode = nodesDataRef.current.find(node => node.id === highlightedThreatId);
      
      if (highlightedNode && highlightedNode.x !== undefined && highlightedNode.y !== undefined) {
        const svg = d3.select(svgRef.current);
        const width = dimensions.width;
        const height = dimensions.height;
        
        // Calculate the transform to center the node
        // We want to zoom to 1.5x and center on the node
        const scale = 1.5;
        const x = -highlightedNode.x * scale + width / 2;
        const y = -highlightedNode.y * scale + height / 2;
        
        // Animate the transition smoothly
        svg.transition()
          .duration(750)
          .call(
            zoomBehaviorRef.current.transform as any,
            d3.zoomIdentity.translate(x, y).scale(scale)
          );
      }
    }
  }, [highlightedThreatId, dimensions.width, dimensions.height]);

  return (
    <>
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Relationships</h3>
        <div className="flex-1 relative min-h-0">
          <div className="absolute top-2 left-2 z-10 bg-card/80 backdrop-blur-sm rounded-md p-2 text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--danger))]"></div>
                <span>Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning))]"></div>
                <span>High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--info))]"></div>
                <span>Medium/Asset</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--muted))]"></div>
                <span>Low</span>
              </div>
            </div>
          </div>
          
          {/* Spotlight Button */}
          <div className="absolute bottom-2 left-2 z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsModalOpen(true)}
              className="bg-card/90 backdrop-blur-sm h-8 w-8"
              title="Open Spotlight View"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ background: 'hsl(var(--card))' }}
          />
        </div>
      </div>

      {/* Spotlight Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 [&>button]:z-10">
          <SpotlightLayout
            title="Relationships"
            filters={
              <div className="space-y-6">
                {/* Node Type Filter */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Show Nodes</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-threats"
                        checked={spotlightFilters.showThreats}
                        onCheckedChange={(checked) => {
                          setSpotlightFilters(prev => ({
                            ...prev,
                            showThreats: !!checked
                          }));
                        }}
                      />
                      <Label htmlFor="show-threats" className="text-sm cursor-pointer">
                        Threats
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-assets"
                        checked={spotlightFilters.showAssets}
                        onCheckedChange={(checked) => {
                          setSpotlightFilters(prev => ({
                            ...prev,
                            showAssets: !!checked
                          }));
                        }}
                      />
                      <Label htmlFor="show-assets" className="text-sm cursor-pointer">
                        Assets
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Severity Filter */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Severity</h3>
                  <div className="space-y-2">
                    {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((severity) => (
                      <div key={severity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`net-severity-${severity}`}
                          checked={spotlightFilters.severities.includes(severity)}
                          onCheckedChange={(checked) => {
                            setSpotlightFilters(prev => ({
                              ...prev,
                              severities: checked
                                ? [...prev.severities, severity]
                                : prev.severities.filter(s => s !== severity)
                            }));
                          }}
                        />
                        <Label htmlFor={`net-severity-${severity}`} className="text-sm cursor-pointer">
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-3">Legend</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--danger))]"></div>
                      <span>Critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning))]"></div>
                      <span>High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--info))]"></div>
                      <span>Medium/Asset</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--muted))]"></div>
                      <span>Low</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <svg
              ref={modalSvgRef}
              style={{ 
                width: '100%', 
                height: '100%',
                background: 'hsl(var(--card))' 
              }}
            />
          </SpotlightLayout>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NetworkGraph;

