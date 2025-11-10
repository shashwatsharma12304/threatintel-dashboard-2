import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Threat, SeverityLevel } from '@/types/threat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
}

const RadarCanvas = ({ threats, selectedThreatIds, onThreatClick, activeSeverityFilter, onSeverityFilterChange }: RadarCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const size = 600;
  const center = size / 2;
  const rings = 4;
  const ringGap = (size * 0.85) / (2 * rings);
  const perspective = 0; // Set to 0 to disable 3D projection

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

  const getQuadrantForAsset = (asset: string): 'NW' | 'NE' | 'SE' | 'SW' => {
    const lowerAsset = asset.toLowerCase();
    // NW: Identity/Access (SSO, IAM, AD/Entra)
    if (['sso', 'iam', 'ad', 'entra', 'okta', 'identity', 'auth'].some(kw => lowerAsset.includes(kw))) {
      return 'NW';
    }
    // NE: Endpoint & Email (EDR, mail, browsers)
    if (['edr', 'mail', 'browser', 'endpoint', 'windows', 'linux', 'email', 'workstation'].some(kw => lowerAsset.includes(kw))) {
      return 'NE';
    }
    // SE: Cloud/SaaS/Containers (AWS, GCP, K8s)
    if (['aws', 'gcp', 'k8s', 'kubernetes', 'container', 'saas', 'cloud', 's3', 'serverless', 'npm', 'java', 'web application'].some(kw => lowerAsset.includes(kw))) {
      return 'SE';
    }
    // SW: Network/Edge/OT (VPN, FW, IoT/ICS)
    if (['vpn', 'fw', 'firewall', 'iot', 'ics', 'network', 'edge', 'router', 'switch', 'database', 'db', 'redis', 'postgresql'].some(kw => lowerAsset.includes(kw))) {
      return 'SW';
    }
    // Fallback
    const hash = asset.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const quadrants: ('NW' | 'NE' | 'SE' | 'SW')[] = ['SE', 'NE', 'SW', 'NW']; // Spreading the fallback
    return quadrants[Math.abs(hash) % 4];
  };

  const quadrantAngleRange: Record<'NW' | 'NE' | 'SE' | 'SW', { min: number, max: number }> = {
    SE: { min: 0, max: 90 },     // Bottom-Right
    SW: { min: 90, max: 180 },   // Bottom-Left
    NW: { min: 180, max: 270 }, // Top-Left
    NE: { min: 270, max: 360 }, // Top-Right
  };

  // Hash function for stable angle generation
  const hashToAngle = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return ((hash % 360) + 360) % 360;
  };

  // Calculate positions using MongoDB theta_deg and radius_norm
  const threatPositions = useMemo(() => {
    const positions: ThreatPosition[] = [];
    
    threats.forEach((threat) => {
      // Use theta_deg and radius_norm directly from MongoDB
      const angle = threat.theta_deg;
      const normalizedRadius = threat.radius_norm;
      
      // Convert normalized radius (0-1) to pixel radius
      // Invert: higher priority (lower radius_norm) = closer to center
      const maxRadius = ringGap * rings;
      const radius = normalizedRadius * maxRadius;

      const x = center + radius * Math.cos((angle * Math.PI) / 180);
      const y = center + radius * Math.sin((angle * Math.PI) / 180);

      positions.push({ id: threat.id, x, y, threat });
    });

    return positions;
  }, [threats, center, ringGap, rings]);

  // Filter threats by severity
  const filteredPositions = useMemo(() => {
    if (activeSeverityFilter === 'All') return threatPositions;
    return threatPositions.filter(pos => pos.threat.severity === activeSeverityFilter);
  }, [threatPositions, activeSeverityFilter]);

  // Find threat at mouse position
  const findThreatAtPosition = useCallback((mouseX: number, mouseY: number): ThreatPosition | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (mouseX - rect.left) * scaleX;
    const y = (mouseY - rect.top) * scaleY;

    // Account for zoom and pan
    const centerX = size / 2;
    const centerY = size / 2;
    const adjustedX = centerX + (x - centerX - panX) / zoom;
    const adjustedY = centerY + (y - centerY - panY) / zoom;

    for (const pos of filteredPositions) {
      const dist = Math.sqrt((pos.x - adjustedX) ** 2 + (pos.y - adjustedY) ** 2);
      if (dist < 6) { // Adjusted for smaller dots
        return pos;
      }
    }
    return null;
  }, [filteredPositions, zoom, panX, panY]);

  // Helper function to project 3D coordinates with perspective
  const project3D = useCallback((x: number, y: number, z: number) => {
    const scale = 1 / (1 + z * perspective);
    return {
      x: center + (x - center) * scale,
      y: center + (y - center) * scale,
      scale: scale
    };
  }, [center, perspective]);

  // Draw function with new flat design
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(center + panX, center + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-center, -center);

    // Draw dark background with subtle gradient
    const bgGradient = ctx.createRadialGradient(center, center, 0, center, center, size);
    bgGradient.addColorStop(0, '#0A0E1A');
    bgGradient.addColorStop(0.5, '#0D1117');
    bgGradient.addColorStop(1, '#050709');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, size, size);

    const radarGreen = '#3D9970'; // Muted green for a tactical look
    const radarGreenBright = '#61FFB8'; // Bright green for highlights

    // Draw rings with improved styling
    for (let i = 0; i < rings; i++) {
      const ringRadius = (i + 1) * ringGap;
      const ringAlpha = 0.3 + (i * 0.1);
      
      // Outer glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = radarGreen;
      ctx.strokeStyle = radarGreen;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.strokeStyle = radarGreenBright;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = ringAlpha * 0.5;
      ctx.beginPath();
      ctx.arc(center, center, ringRadius - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Draw spokes (8 spokes every 45°) with gradient
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 * Math.PI) / 180;
      const gradient = ctx.createLinearGradient(
        center, center,
        center + (ringGap * rings) * Math.cos(angle),
        center + (ringGap * rings) * Math.sin(angle)
      );
      gradient.addColorStop(0, radarGreenBright);
      gradient.addColorStop(0.5, radarGreen);
      gradient.addColorStop(1, 'rgba(61, 153, 112, 0)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + (ringGap * rings) * Math.cos(angle), center + (ringGap * rings) * Math.sin(angle));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw Quadrant Labels with improved styling
    // NW Quadrant (Top-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.fillStyle = '#94e8c1'; // Brighter green for title
    ctx.font = `bold 13px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('Identity/Access', 40, 40);
    ctx.fillStyle = '#7C8A9A'; // Muted gray for subtitle
    ctx.font = `normal 10px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('(SSO, IAM, AD/Entra)', 40, 58);

    // NE Quadrant (Top-Right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 13px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('Endpoint & Email', size - 40, 40);
    ctx.fillStyle = '#7C8A9A';
    ctx.font = `normal 10px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('(EDR, mail, browsers)', size - 40, 58);

    // SW Quadrant (Bottom-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#7C8A9A';
    ctx.font = `normal 10px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('(VPN, FW, IoT/ICS)', 40, size - 40);
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 13px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('Network/Edge/OT', 40, size - 58);

    // SE Quadrant (Bottom-Right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#7C8A9A';
    ctx.font = `normal 10px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('(AWS, GCP, K8s)', size - 40, size - 40);
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 13px "Inter", "Helvetica Neue", sans-serif`;
    ctx.fillText('Cloud/SaaS/Containers', size - 40, size - 58);
    ctx.shadowBlur = 0;

    // Reset text properties
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw sweep wedge with improved animation
    const sweepAngle = sweepAngleRef.current;
    const sweepWidth = 60; // degrees
    
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((sweepAngle * Math.PI) / 180);
    
    // Enhanced sweep gradient
    const sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ringGap * rings);
    sweepGradient.addColorStop(0, 'rgba(97, 255, 184, 0.4)');
    sweepGradient.addColorStop(0.3, 'rgba(61, 153, 112, 0.25)');
    sweepGradient.addColorStop(0.7, 'rgba(61, 153, 112, 0.1)');
    sweepGradient.addColorStop(1, 'rgba(61, 153, 112, 0)');
    
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ringGap * rings, 0, (sweepWidth * Math.PI) / 180);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    // Leading edge with glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = radarGreenBright;
    ctx.strokeStyle = radarGreenBright;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ringGap * rings, 0);
    ctx.stroke();
    
    // Secondary edge line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = radarGreen;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ringGap * rings, 0);
    ctx.stroke();
    
    ctx.restore();

    // Draw ring labels
    const severities: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
    ctx.fillStyle = radarGreen;
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rings; i++) {
        const ringRadius = (i + 1) * ringGap;
        // Position labels along the top spoke
        ctx.save();
        ctx.translate(center, center - ringRadius);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#1e4b37';
        ctx.fillRect(-25, -10, 50, 20);
        ctx.fillStyle = '#94e8c1';
        ctx.fillText(capitalizeFirst(severities[i]), 0, 0);
        ctx.restore();
    }

    // Draw center dot with enhanced styling
    const centerGlow = ctx.createRadialGradient(center, center, 0, center, center, 20);
    centerGlow.addColorStop(0, '#A6FFD5');
    centerGlow.addColorStop(0.5, 'rgba(97, 255, 184, 0.5)');
    centerGlow.addColorStop(1, 'rgba(61, 153, 112, 0)');
    ctx.shadowBlur = 20;
    ctx.shadowColor = radarGreenBright;
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#EFFFF5';
    ctx.beginPath();
    ctx.arc(center, center, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner core
    ctx.fillStyle = radarGreenBright;
    ctx.beginPath();
    ctx.arc(center, center, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.fillStyle = radarGreenBright;
    ctx.font = 'bold 10px "Inter", "Courier New", monospace';
    ctx.fillText('YOU', center, center + 22);
    ctx.shadowBlur = 0;


    // Draw threat dots
    const sortedPositions = [...filteredPositions].sort((a, b) => {
      const distA = Math.sqrt((a.x - center) ** 2 + (a.y - center) ** 2);
      const distB = Math.sqrt((b.x - center) ** 2 + (b.y - center) ** 2);
      return distB - distA; // Draw far ones first
    });

    sortedPositions.forEach(({ id, x, y, threat }) => {
      const isSelected = selectedThreatIds.includes(id);
      const dotColor = severityColors[threat.severity];
      const isNew = threat.status === 'new';

      let alpha = 1;
      if (isNew) {
        // Blinking effect for new items
        alpha = 0.5 + Math.sin(Date.now() / 200) * 0.5;
      }
      
      // Pulsing ring for selected threats (adjusted for smaller dots)
      if (isSelected) {
        const pulseTime = Date.now() / 1000;
        const pulseRadius = 8 + Math.sin(pulseTime * 3) * 3;
        const pulseAlpha = 0.6 - Math.abs(Math.sin(pulseTime * 3)) * 0.4;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = dotColor;
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Additional outer pulse ring
        const outerPulseRadius = pulseRadius + 6;
        const outerPulseAlpha = pulseAlpha * 0.3;
        ctx.shadowBlur = 5;
        ctx.globalAlpha = outerPulseAlpha;
        ctx.beginPath();
        ctx.arc(x, y, outerPulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      ctx.globalAlpha = alpha;

      // Outer ring of the dot (reduced by half: 8->4, 7->3.5)
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.shadowBlur = isSelected ? 8 : 4;
      ctx.shadowColor = dotColor;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill of the dot
      ctx.shadowBlur = 0;
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Core highlight
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1; // Reset alpha
    });

    ctx.restore();
  }, [filteredPositions, selectedThreatIds, zoom, panX, panY, center, project3D, severityToRing, severityColors]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Start dragging if:
    // 1. Middle mouse button (button 1)
    // 2. Ctrl/Cmd + left click
    // 3. Right mouse button
    if (e.button === 1 || e.ctrlKey || e.metaKey || e.button === 2) {
      e.preventDefault();
      setIsDragging(true);
      setHasMoved(false);
      setDragStart({ x: e.clientX, y: e.clientY });
      setPanStart({ x: panX, y: panY });
    } else if (e.button === 0) {
      // Left click - check if clicking on empty space
      const threat = findThreatAtPosition(e.clientX, e.clientY);
      if (!threat) {
        // Start dragging if clicking on empty space
        setIsDragging(true);
        setHasMoved(false);
        setDragStart({ x: e.clientX, y: e.clientY });
        setPanStart({ x: panX, y: panY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      // Calculate pan delta
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      // Check if mouse has moved significantly (more than 3 pixels)
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
    // Only trigger click if we didn't drag (or moved less than 3 pixels)
    if (!hasMoved) {
      const threat = findThreatAtPosition(e.clientX, e.clientY);
      if (threat) {
        // Single selection - clicking a threat selects it and opens the details panel
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
    if (!canvas) return;
    
    canvas.width = size;
    canvas.height = size;
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative">
      <canvas
        ref={canvasRef}
        className={isDragging ? "cursor-grabbing" : "cursor-grab"}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right click
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
      
      {/* Tooltip */}
      {hoveredThreat && (
        <div
          className="fixed bg-card border border-border rounded-lg p-3 pointer-events-none z-50 max-w-xs shadow-xl backdrop-blur-sm"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold text-sm">{hoveredThreat.threat_name}</p>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-xs">
                {capitalizeFirst(hoveredThreat.severity)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {capitalizeFirst(hoveredThreat.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Asset: {getPrimaryAsset(hoveredThreat)}
            </p>
            <p className="text-xs text-muted-foreground">
              Source: {hoveredThreat.source}
            </p>
            <p className="text-xs text-muted-foreground">
              First seen: {new Date(hoveredThreat.first_seen).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadarCanvas;
