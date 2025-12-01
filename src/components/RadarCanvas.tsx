import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Threat, SeverityLevel, StatusType, QuadrantType, getQuadrant, getDefenderFunction, QUADRANT_INFO } from '@/types/threat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SpotlightLayout from '@/components/SpotlightLayout';

interface RadarCanvasProps {
  threats: Threat[];
  selectedThreatIds: string[];
  onThreatClick: (threatId: string, multiSelect: boolean) => void;
  activeSeverityFilter: SeverityLevel | 'All';
  onSeverityFilterChange: (severity: SeverityLevel | 'All') => void;
}

interface ThreatPosition {
  id: string;
  x: number;
  y: number;
  threat: Threat;
  quadrant: QuadrantType;
}

const RadarCanvas = ({ threats, selectedThreatIds, onThreatClick, activeSeverityFilter, onSeverityFilterChange }: RadarCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredThreat, setHoveredThreat] = useState<Threat | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const sweepAngleRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState(800);

  // Spotlight-specific filters
  const [spotlightFilters, setSpotlightFilters] = useState({
    statuses: ['new', 'active', 'mitigated'] as StatusType[],
    severities: ['critical', 'high', 'medium', 'low'] as SeverityLevel[],
  });

  const [size, setSize] = useState(600);
  const center = size / 2;
  const rings = 4;
  const ringGap = (size * 0.85) / (2 * rings);

  const severityToRing: Record<SeverityLevel, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  const severityColors: Record<SeverityLevel, string> = {
    critical: '#FF4D4F',
    high: '#FFA940',
    medium: '#FFD666',
    low: '#69C0FF',
  };

  // Quadrant angle ranges (canvas coordinates: 0° = right, clockwise)
  // Pre-Protect (Top-Left): 180-270°
  // Post-Protect (Top-Right): 270-360°
  // Pre-Detect (Bottom-Left): 90-180°
  // Post-Detect (Bottom-Right): 0-90°
  const quadrantAngleRange: Record<QuadrantType, { min: number; max: number }> = {
    post_detect: { min: 0, max: 90 },      // Bottom-Right: Post × Detect/Respond
    pre_detect: { min: 90, max: 180 },     // Bottom-Left: Pre × Detect/Respond
    pre_protect: { min: 180, max: 270 },   // Top-Left: Pre × Protect
    post_protect: { min: 270, max: 360 },  // Top-Right: Post × Protect
  };

  // Helper to get primary asset name
  const getPrimaryAsset = (threat: Threat): string => {
    if (threat.assets_impacted && threat.assets_impacted.length > 0) {
      return threat.assets_impacted[0].product_name;
    }
    return 'Unknown Asset';
  };

  // Helper to capitalize for display
  const capitalizeFirst = (s: string): string => {
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  };

  // Hash function for stable angle generation within quadrant
  const hashToAngleOffset = (id: string, range: number): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % Math.floor(range * 0.8)) + (range * 0.1); // Keep away from edges
  };

  // Calculate positions based on quadrant mapping
  const threatPositions = useMemo(() => {
    const positions: ThreatPosition[] = [];
    const quadrantCounts: Record<QuadrantType, number> = {
      pre_protect: 0,
      pre_detect: 0,
      post_protect: 0,
      post_detect: 0,
    };
    
    threats.forEach((threat) => {
      const quadrant = getQuadrant(threat);
      const { min, max } = quadrantAngleRange[quadrant];
      const angleRange = max - min;
      
      // Calculate angle within quadrant using hash for distribution
      const angleOffset = hashToAngleOffset(threat.id, angleRange);
      const angle = min + angleOffset;
      
      // Use severity to determine distance from center
      // Critical = closest to center, Low = furthest
      const ring = severityToRing[threat.severity];
      const maxRadius = ringGap * rings;
      const baseRadius = (ring / rings) * maxRadius;
      // Add small random offset based on id hash for visual spread
      const radiusOffset = (hashToAngleOffset(threat.id + 'r', ringGap * 0.5)) - (ringGap * 0.25);
      const radius = Math.max(ringGap * 0.5, Math.min(maxRadius, baseRadius + radiusOffset));

      const x = center + radius * Math.cos((angle * Math.PI) / 180);
      const y = center + radius * Math.sin((angle * Math.PI) / 180);

      positions.push({ id: threat.id, x, y, threat, quadrant });
      quadrantCounts[quadrant]++;
    });

    return positions;
  }, [threats, center, ringGap, rings]);

  // Filter threats by severity
  const filteredPositions = useMemo(() => {
    if (activeSeverityFilter === 'All') return threatPositions;
    return threatPositions.filter(pos => pos.threat.severity === activeSeverityFilter);
  }, [threatPositions, activeSeverityFilter]);

  // Filter threats for spotlight modal
  const spotlightFilteredPositions = useMemo(() => {
    return threatPositions.filter(pos => {
      const statusMatch = spotlightFilters.statuses.includes(pos.threat.status);
      const severityMatch = spotlightFilters.severities.includes(pos.threat.severity);
      return statusMatch && severityMatch;
    });
  }, [threatPositions, spotlightFilters]);

  // Find threat at mouse position
  const findThreatAtPosition = useCallback((mouseX: number, mouseY: number): ThreatPosition | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = mouseX - rect.left;
    const y = mouseY - rect.top;

    const centerX = size / 2;
    const centerY = size / 2;
    const adjustedX = centerX + (x - centerX - panX) / zoom;
    const adjustedY = centerY + (y - centerY - panY) / zoom;

    for (const pos of filteredPositions) {
      const dist = Math.sqrt((pos.x - adjustedX) ** 2 + (pos.y - adjustedY) ** 2);
      if (dist < 8) {
        return pos;
      }
    }
    return null;
  }, [filteredPositions, zoom, panX, panY, size]);

  // Draw function with quadrant-based design
  const draw = useCallback((canvas?: HTMLCanvasElement, customSize?: number, positions?: ThreatPosition[]) => {
    const targetCanvas = canvas || canvasRef.current;
    if (!targetCanvas) return;
    const canvasSize = customSize || size;
    // Don't draw if canvas size is not properly set yet or too small
    // Minimum size of 100px to ensure proper rendering
    if (canvasSize < 100) return;
    const canvasCenter = canvasSize / 2;
    const canvasRingGap = (canvasSize * 0.85) / (2 * rings);
    const positionsToRender = positions || filteredPositions;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas and set theme-aware background
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#0A0F1E' : '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(canvasCenter + panX, canvasCenter + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvasCenter, -canvasCenter);

    const radarGreen = '#1a5c3a';
    const radarGreenBright = '#00ff88';

    // Draw concentric rings
    for (let i = 0; i < rings; i++) {
      const ringRadius = (i + 1) * canvasRingGap;
      const ringAlpha = 0.3 + (i * 0.1);
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = radarGreen;
      ctx.strokeStyle = radarGreen;
      ctx.lineWidth = 2;
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(canvasCenter, canvasCenter, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.strokeStyle = radarGreenBright;
      ctx.lineWidth = 1;
      ctx.globalAlpha = ringAlpha * 0.7;
      ctx.beginPath();
      ctx.arc(canvasCenter, canvasCenter, Math.max(1, ringRadius - 1), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Draw quadrant dividing lines (X and Y axes through center)
    const maxRadius = canvasRingGap * rings;
    
    // Horizontal axis (Pre vs Post)
    const hGradient = ctx.createLinearGradient(canvasCenter - maxRadius, canvasCenter, canvasCenter + maxRadius, canvasCenter);
    hGradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
    hGradient.addColorStop(0.3, radarGreen);
    hGradient.addColorStop(0.5, radarGreenBright);
    hGradient.addColorStop(0.7, radarGreen);
    hGradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
    
    ctx.strokeStyle = hGradient;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(canvasCenter - maxRadius, canvasCenter);
    ctx.lineTo(canvasCenter + maxRadius, canvasCenter);
    ctx.stroke();

    // Vertical axis (Protect vs Detect/Respond)
    const vGradient = ctx.createLinearGradient(canvasCenter, canvasCenter - maxRadius, canvasCenter, canvasCenter + maxRadius);
    vGradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
    vGradient.addColorStop(0.3, radarGreen);
    vGradient.addColorStop(0.5, radarGreenBright);
    vGradient.addColorStop(0.7, radarGreen);
    vGradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
    
    ctx.strokeStyle = vGradient;
    ctx.beginPath();
    ctx.moveTo(canvasCenter, canvasCenter - maxRadius);
    ctx.lineTo(canvasCenter, canvasCenter + maxRadius);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw Quadrant Labels - simplified
    const labelTitleColor = isDark ? '#94e8c1' : '#1a5c3a';
    
    ctx.shadowBlur = 2;
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    ctx.font = `bold 11px "Inter", "Helvetica Neue", sans-serif`;

    // Pre × Protect (Top-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = labelTitleColor;
    ctx.fillText('PRE × PROTECT', 15, 15);

    // Post × Protect (Top-Right)
    ctx.textAlign = 'right';
    ctx.fillText('POST × PROTECT', canvasSize - 15, 15);

    // Pre × Detect/Respond (Bottom-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PRE × DETECT', 15, canvasSize - 15);

    // Post × Detect/Respond (Bottom-Right)
    ctx.textAlign = 'right';
    ctx.fillText('POST × DETECT', canvasSize - 15, canvasSize - 15);
    
    ctx.shadowBlur = 0;

    // Draw sweep wedge
    const sweepAngle = sweepAngleRef.current;
    const sweepWidth = 60;
    
    ctx.save();
    ctx.translate(canvasCenter, canvasCenter);
    ctx.rotate((sweepAngle * Math.PI) / 180);
    
    const sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, canvasRingGap * rings);
    sweepGradient.addColorStop(0, 'rgba(0, 255, 136, 0.5)');
    sweepGradient.addColorStop(0.3, 'rgba(26, 92, 58, 0.35)');
    sweepGradient.addColorStop(0.7, 'rgba(26, 92, 58, 0.15)');
    sweepGradient.addColorStop(1, 'rgba(26, 92, 58, 0)');
    
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, canvasRingGap * rings, 0, (sweepWidth * Math.PI) / 180);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = radarGreenBright;
    ctx.strokeStyle = radarGreenBright;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvasRingGap * rings, 0);
    ctx.stroke();
    
    ctx.shadowBlur = 5;
    ctx.shadowColor = radarGreen;
    ctx.strokeStyle = radarGreen;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvasRingGap * rings, 0);
    ctx.stroke();
    
    ctx.restore();

    // Draw minimal severity indicators on left edge
    const severities: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
    ctx.font = 'bold 8px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? 'rgba(148, 232, 193, 0.6)' : 'rgba(26, 92, 58, 0.6)';
    
    for (let i = 0; i < rings; i++) {
      const ringRadius = (i + 1) * canvasRingGap;
      ctx.fillText(severities[i].charAt(0).toUpperCase(), canvasCenter - ringRadius - 4, canvasCenter);
    }

    // Draw center dot
    const centerGlow = ctx.createRadialGradient(canvasCenter, canvasCenter, 0, canvasCenter, canvasCenter, 20);
    centerGlow.addColorStop(0, '#00ff88');
    centerGlow.addColorStop(0.5, 'rgba(0, 255, 136, 0.5)');
    centerGlow.addColorStop(1, 'rgba(26, 92, 58, 0)');
    ctx.shadowBlur = 20;
    ctx.shadowColor = radarGreenBright;
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(canvasCenter, canvasCenter, 20, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#EFFFF5';
    ctx.beginPath();
    ctx.arc(canvasCenter, canvasCenter, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = radarGreenBright;
    ctx.beginPath();
    ctx.arc(canvasCenter, canvasCenter, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 3;
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    ctx.fillStyle = isDark ? '#94e8c1' : '#1a5c3a';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', canvasCenter, canvasCenter + 24);
    ctx.shadowBlur = 0;

    // Draw threat dots
    const sortedPositions = [...positionsToRender].sort((a, b) => {
      const distA = Math.sqrt((a.x - canvasCenter) ** 2 + (a.y - canvasCenter) ** 2);
      const distB = Math.sqrt((b.x - canvasCenter) ** 2 + (b.y - canvasCenter) ** 2);
      return distB - distA;
    });

    sortedPositions.forEach(({ id, x, y, threat }) => {
      const isSelected = selectedThreatIds.includes(id);
      const dotColor = severityColors[threat.severity];
      const isNew = threat.status === 'new';
      const hasSelection = selectedThreatIds.length > 0;

      let alpha = 1;
      
      // Dim non-selected threats when there's a selection
      if (hasSelection && !isSelected) {
        alpha = 0.3;
      } else if (isNew) {
        // Blinking effect for new items (only when not dimmed)
        alpha = 0.5 + Math.sin(Date.now() / 200) * 0.5;
      }
      
      if (isSelected) {
        const pulseTime = Date.now() / 1000;
        const pulseRadius = 10 + Math.sin(pulseTime * 3) * 3;
        const pulseAlpha = 0.6 - Math.abs(Math.sin(pulseTime * 3)) * 0.4;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = dotColor;
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        const outerPulseRadius = pulseRadius + 6;
        const outerPulseAlpha = pulseAlpha * 0.3;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = outerPulseAlpha;
        ctx.beginPath();
        ctx.arc(x, y, outerPulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      ctx.globalAlpha = alpha;

      // Larger dots for selected threats
      const dotRadius = isSelected ? 8 : 7;
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.shadowBlur = isSelected ? 18 : (hasSelection && !isSelected ? 2 : 6);
      ctx.shadowColor = dotColor;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, dotRadius - 1), 0, Math.PI * 2);
      ctx.fill();
      
      // Only show highlight for selected or when no selection
      if (isSelected || !hasSelection) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }, [filteredPositions, selectedThreatIds, zoom, panX, panY, size, rings, severityColors]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      draw();
      
      if (isModalOpen && modalCanvasRef.current) {
        draw(modalCanvasRef.current, modalSize, spotlightFilteredPositions);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw, isModalOpen, modalSize, spotlightFilteredPositions]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.ctrlKey || e.metaKey || e.button === 2) {
      e.preventDefault();
      setIsDragging(true);
      setHasMoved(false);
      setDragStart({ x: e.clientX, y: e.clientY });
      setPanStart({ x: panX, y: panY });
    } else if (e.button === 0) {
      const threat = findThreatAtPosition(e.clientX, e.clientY);
      if (!threat) {
        setIsDragging(true);
        setHasMoved(false);
        setDragStart({ x: e.clientX, y: e.clientY });
        setPanStart({ x: panX, y: panY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        setHasMoved(true);
      }
      
      setPanX(panStart.x + deltaX);
      setPanY(panStart.y + deltaY);
    } else {
      const threat = findThreatAtPosition(e.clientX, e.clientY);
      setHoveredThreat(threat?.threat || null);
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setHasMoved(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHasMoved(false);
    setHoveredThreat(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasMoved) {
      const threat = findThreatAtPosition(e.clientX, e.clientY);
      if (threat) {
        onThreatClick(threat.id, false);
      }
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.5, prev - 0.2));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Setup canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const updateSize = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const displaySize = Math.min(containerWidth, containerHeight) * 0.95;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = displaySize * dpr;
      canvas.height = displaySize * dpr;
      
      setSize(displaySize);
    };
    
    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mediaQuery.addEventListener('change', updateSize);
    
    return () => {
      resizeObserver.disconnect();
      mediaQuery.removeEventListener('change', updateSize);
    };
  }, []);

  // Reset spotlight filters when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setSpotlightFilters({
        statuses: ['new', 'active', 'mitigated'] as StatusType[],
        severities: ['critical', 'high', 'medium', 'low'] as SeverityLevel[],
      });
    }
  }, [isModalOpen]);

  // Setup modal canvas
  useEffect(() => {
    if (isModalOpen && modalCanvasRef.current && modalContainerRef.current) {
      const modalCanvas = modalCanvasRef.current;
      const modalContainer = modalContainerRef.current;
      
      const updateModalSize = () => {
        const containerWidth = modalContainer.clientWidth;
        const containerHeight = modalContainer.clientHeight;
        const displaySize = Math.min(containerWidth, containerHeight) * 0.95;
        
        const dpr = window.devicePixelRatio || 1;
        modalCanvas.width = displaySize * dpr;
        modalCanvas.height = displaySize * dpr;
        
        setModalSize(displaySize);
      };
      
      updateModalSize();
      
      const resizeObserver = new ResizeObserver(updateModalSize);
      resizeObserver.observe(modalContainer);
      
      const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mediaQuery.addEventListener('change', updateModalSize);
      
      return () => {
        resizeObserver.disconnect();
        mediaQuery.removeEventListener('change', updateModalSize);
      };
    }
  }, [isModalOpen]);

  // Get quadrant display name for tooltip
  const getQuadrantDisplayName = (threat: Threat): string => {
    const quadrant = getQuadrant(threat);
    return QUADRANT_INFO[quadrant].title;
  };

  const getQuadrantReasoning = (threat: Threat): { stage: string; function: string; tactics: string[]; quadrant: string; reasoning: string } => {
    // Check if any post-compromise tactics are present
    const postCompromiseTactics = ['persistence', 'privilege escalation', 'defense evasion', 'credential access', 
                                   'discovery', 'lateral movement', 'collection', 'command and control', 
                                   'exfiltration', 'impact', 'c2'];
    
    const hasPostTactic = threat.mitre_tactics.some(tactic => {
      const lower = tactic.toLowerCase();
      return postCompromiseTactics.some(keyword => lower.includes(keyword));
    });
    
    const stage = hasPostTactic ? 'Post-compromise' : 'Pre-compromise';
    const quadrant = getQuadrant(threat);
    
    // Determine defender function reasoning
    let defenderFunc: string;
    let reasoning: string;
    
    if (threat.status === 'mitigated') {
      defenderFunc = 'Protect (preventive)';
      reasoning = 'Status is mitigated - preventive measures have been applied';
    } else {
      // Check if this threat was assigned to Protect quadrant
      const defenderFn = getDefenderFunction(threat.status, threat.id);
      if (defenderFn === 'protect') {
        defenderFunc = 'Protect (preventive)';
        reasoning = 'Assigned to Protect quadrant based on threat characteristics (even though status is active/new)';
      } else {
        defenderFunc = 'Detect/Respond (monitoring)';
        reasoning = 'Status is active/new - requires monitoring and incident response';
      }
    }
    
    return {
      stage,
      function: defenderFunc,
      tactics: threat.mitre_tactics.slice(0, 3),
      quadrant: QUADRANT_INFO[quadrant].title,
      reasoning
    };
  };

  return (
    <>
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center relative">
        <canvas
          ref={canvasRef}
          className={isDragging ? "cursor-grabbing" : "cursor-grab"}
          style={{ width: size, height: size }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
        
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetZoom}
            className="h-8 w-8"
            title="Reset Zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="text-xs text-center text-muted-foreground pt-1 border-t border-border mt-1">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Spotlight Button */}
        <div className="absolute bottom-4 left-4">
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
        
        {/* Tooltip */}
        {hoveredThreat && (
          <div
            className="fixed bg-card border border-border rounded-lg p-3 pointer-events-none z-50 max-w-sm shadow-xl backdrop-blur-sm"
            style={{
              left: mousePos.x + 15,
              top: mousePos.y + 15,
            }}
          >
            <div className="space-y-2">
              <p className="font-semibold text-sm">{hoveredThreat.threat_name}</p>
              <div className="flex gap-2 text-xs flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {capitalizeFirst(hoveredThreat.severity)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {capitalizeFirst(hoveredThreat.status)}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {getQuadrantDisplayName(hoveredThreat)}
                </Badge>
              </div>
              
              {/* Quadrant Reasoning */}
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs font-semibold text-foreground mb-1">Quadrant Reasoning:</p>
                {(() => {
                  const reasoning = getQuadrantReasoning(hoveredThreat);
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Stage:</span> {reasoning.stage}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Function:</span> {reasoning.function}
                      </p>
                      {reasoning.tactics.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Tactics:</span> {reasoning.tactics.join(', ')}
                          {hoveredThreat.mitre_tactics.length > 3 && '...'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {reasoning.reasoning}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Threat Details */}
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Asset:</span> {getPrimaryAsset(hoveredThreat)}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Source:</span> {hoveredThreat.source}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spotlight Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 [&>button]:z-10">
          <SpotlightLayout
            title="Threat Radar - Quadrant View"
            filters={
              <div className="space-y-6">
                {/* Status Filter */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Status</h3>
                  <div className="space-y-2">
                    {(['new', 'active', 'mitigated'] as StatusType[]).map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={spotlightFilters.statuses.includes(status)}
                          onCheckedChange={(checked) => {
                            setSpotlightFilters(prev => ({
                              ...prev,
                              statuses: checked
                                ? [...prev.statuses, status]
                                : prev.statuses.filter(s => s !== status)
                            }));
                          }}
                        />
                        <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                          {capitalizeFirst(status)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Severity Filter */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Severity</h3>
                  <div className="space-y-2">
                    {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((severity) => (
                      <div key={severity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`severity-${severity}`}
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
                        <Label htmlFor={`severity-${severity}`} className="text-sm cursor-pointer">
                          {capitalizeFirst(severity)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quadrant Legend */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Quadrants</h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium text-primary">Pre × Protect</p>
                      <p className="text-muted-foreground">Patch, harden, WAF rules</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium text-primary">Post × Protect</p>
                      <p className="text-muted-foreground">Eradication, durable fixes</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium text-primary">Pre × Detect/Respond</p>
                      <p className="text-muted-foreground">Early-warning, hunts</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium text-primary">Post × Detect/Respond</p>
                      <p className="text-muted-foreground">Live IR, forensics</p>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <div ref={modalContainerRef} className="relative w-full h-full flex items-center justify-center">
              <canvas
                ref={modalCanvasRef}
                className={isDragging ? "cursor-grabbing" : "cursor-grab"}
                style={{ width: modalSize, height: modalSize, display: 'block' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
              />
              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomIn}
                  className="h-8 w-8"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomOut}
                  className="h-8 w-8"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetZoom}
                  className="h-8 w-8"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <div className="text-xs text-center text-muted-foreground pt-1 border-t border-border mt-1">
                  {Math.round(zoom * 100)}%
                </div>
              </div>
            </div>
          </SpotlightLayout>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RadarCanvas;
