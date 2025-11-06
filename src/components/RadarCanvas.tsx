import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Threat, SeverityLevel } from '@/types/threat';
import { Badge } from '@/components/ui/badge';

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
  const sweepAngleRef = useRef(0);
  const animationFrameRef = useRef<number>();

  const size = 600;
  const center = size / 2;
  const rings = 4;
  const ringGap = (size * 0.85) / (2 * rings);
  const perspective = 0; // Set to 0 to disable 3D projection

  const severityToRing: Record<SeverityLevel, number> = {
    Critical: 1,
    High: 2,
    Medium: 3,
    Low: 4,
  };

  const severityColors: Record<SeverityLevel, string> = {
    Critical: '#FF4D4F',
    High: '#FFA940',
    Medium: '#FFD666',
    Low: '#69C0FF',
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

  // Calculate positions with collision avoidance
  const threatPositions = useMemo(() => {
    const positions: ThreatPosition[] = [];
    
    threats.forEach((threat) => {
      const ring = severityToRing[threat.severity];
      const radius = ring * ringGap;

      const quadrant = getQuadrantForAsset(threat.asset);
      const { min, max } = quadrantAngleRange[quadrant];
      const angleRange = max - min;
      
      let angle = min + (hashToAngle(threat.id) % angleRange);

      // Simple collision avoidance
      let attempts = 0;
      while (attempts < 10) {
        const x = center + radius * Math.cos((angle * Math.PI) / 180);
        const y = center + radius * Math.sin((angle * Math.PI) / 180);

        const collision = positions.some(pos => {
          const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
          return dist < 60; // Further increased minimum distance
        });

        if (!collision || attempts === 9) {
          positions.push({ id: threat.id, x, y, threat });
          break;
        }

        angle += 30; // Further increased angle step
        attempts++;
      }
    });

    return positions;
  }, [threats, center, ringGap]);

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

    // Account for zoom
    const centerX = size / 2;
    const centerY = size / 2;
    const adjustedX = centerX + (x - centerX) / zoom;
    const adjustedY = centerY + (y - centerY) / zoom;

    for (const pos of filteredPositions) {
      const dist = Math.sqrt((pos.x - adjustedX) ** 2 + (pos.y - adjustedY) ** 2);
      if (dist < 8) {
        return pos;
      }
    }
    return null;
  }, [filteredPositions, zoom]);

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

    // Apply zoom transform
    ctx.save();
    ctx.translate(center, center);
    ctx.scale(zoom, zoom);
    ctx.translate(-center, -center);

    // Draw dark background
    ctx.fillStyle = '#0D1117'; // A very dark blue, almost black
    ctx.fillRect(0, 0, size, size);

    const radarGreen = '#3D9970'; // Muted green for a tactical look

    // Draw rings
    ctx.strokeStyle = radarGreen;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < rings; i++) {
      const ringRadius = (i + 1) * ringGap;
      ctx.beginPath();
      ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw spokes (8 spokes every 45°)
    ctx.strokeStyle = radarGreen;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + (ringGap * rings) * Math.cos(angle), center + (ringGap * rings) * Math.sin(angle));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw Quadrant Labels
    // NW Quadrant (Top-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94e8c1'; // Brighter green for title
    ctx.font = `bold 12px "Helvetica", sans-serif`;
    ctx.fillText('Identity/Access', 40, 40);
    ctx.fillStyle = '#a0aec0'; // Muted gray for subtitle
    ctx.font = `normal 10px "Helvetica", sans-serif`;
    ctx.fillText('(SSO, IAM, AD/Entra)', 40, 58);

    // NE Quadrant (Top-Right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 12px "Helvetica", sans-serif`;
    ctx.fillText('Endpoint & Email', size - 40, 40);
    ctx.fillStyle = '#a0aec0';
    ctx.font = `normal 10px "Helvetica", sans-serif`;
    ctx.fillText('(EDR, mail, browsers)', size - 40, 58);

    // SW Quadrant (Bottom-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#a0aec0';
    ctx.font = `normal 10px "Helvetica", sans-serif`;
    ctx.fillText('(VPN, FW, IoT/ICS)', 40, size - 40);
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 12px "Helvetica", sans-serif`;
    ctx.fillText('Network/Edge/OT', 40, size - 58);


    // SE Quadrant (Bottom-Right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#a0aec0';
    ctx.font = `normal 10px "Helvetica", sans-serif`;
    ctx.fillText('(AWS, GCP, K8s)', size - 40, size - 40);
    ctx.fillStyle = '#94e8c1';
    ctx.font = `bold 12px "Helvetica", sans-serif`;
    ctx.fillText('Cloud/SaaS/Containers', size - 40, size - 58);

    // Reset text properties
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw sweep wedge
    const sweepAngle = sweepAngleRef.current;
    const sweepWidth = 60; // degrees
    
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((sweepAngle * Math.PI) / 180);
    
    const sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ringGap * rings);
    sweepGradient.addColorStop(0, 'rgba(61, 153, 112, 0.3)');
    sweepGradient.addColorStop(1, 'rgba(61, 153, 112, 0)');
    
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ringGap * rings, 0, (sweepWidth * Math.PI) / 180);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    // Leading edge glow
    ctx.strokeStyle = '#61ffb8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ringGap * rings, 0);
    ctx.stroke();
    
    ctx.restore();

    // Draw ring labels
    const severities: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
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
        ctx.fillText(severities[i], 0, 0);
        ctx.restore();
    }

    // Draw center dot
    const centerGlow = ctx.createRadialGradient(center, center, 0, center, center, 12);
    centerGlow.addColorStop(0, '#A6FFD5');
    centerGlow.addColorStop(1, 'rgba(61, 153, 112, 0)');
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(center, center, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#EFFFF5';
    ctx.beginPath();
    ctx.arc(center, center, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = radarGreen;
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillText('YOU', center, center + 20);


    // Draw threat dots
    const sortedPositions = [...filteredPositions].sort((a, b) => {
      const distA = Math.sqrt((a.x - center) ** 2 + (a.y - center) ** 2);
      const distB = Math.sqrt((b.x - center) ** 2 + (b.y - center) ** 2);
      return distB - distA; // Draw far ones first
    });

    sortedPositions.forEach(({ id, x, y, threat }) => {
      const isSelected = selectedThreatIds.includes(id);
      const dotColor = severityColors[threat.severity];
      const isNew = threat.status === 'New';

      let alpha = 1;
      if (isNew) {
        // Blinking effect for new items
        alpha = 0.5 + Math.sin(Date.now() / 200) * 0.5;
      }
      
      // Pulsing ring for selected threats
      if (isSelected) {
        const pulseTime = Date.now() / 1000;
        const pulseRadius = 12 + Math.sin(pulseTime * 3) * 4;
        const pulseAlpha = 0.6 - Math.abs(Math.sin(pulseTime * 3)) * 0.4;
        
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Additional outer pulse ring
        const outerPulseRadius = pulseRadius + 8;
        const outerPulseAlpha = pulseAlpha * 0.3;
        ctx.globalAlpha = outerPulseAlpha;
        ctx.beginPath();
        ctx.arc(x, y, outerPulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.globalAlpha = alpha;

      // Outer ring of the dot
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill of the dot
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = alpha * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1; // Reset alpha

      // Labels
      ctx.textAlign = 'center';
      ctx.fillStyle = dotColor;
      ctx.font = `bold 10px "Helvetica", sans-serif`;
      ctx.fillText(threat.name, x, y - 15);
      
      ctx.fillStyle = '#a0aec0'; // a muted gray for the asset
      ctx.font = `normal 9px "Helvetica", sans-serif`;
      ctx.fillText(threat.asset, x, y + 15);
    });

    ctx.restore();
  }, [filteredPositions, selectedThreatIds, zoom, center, project3D, severityToRing, severityColors]);

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
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const threat = findThreatAtPosition(e.clientX, e.clientY);
    setHoveredThreat(threat?.threat || null);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredThreat(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const threat = findThreatAtPosition(e.clientX, e.clientY);
    if (threat) {
      // Single selection - clicking a threat selects it and opens the details panel
      onThreatClick(threat.id, false);
    }
  };

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.8, Math.min(1.2, prev + delta)));
    }
  };

  // Setup canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = size;
    canvas.height = size;
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      
      {/* Tooltip */}
      {hoveredThreat && (
        <div
          className="fixed bg-card border border-border rounded-lg p-3 pointer-events-none z-50 max-w-xs shadow-xl"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold text-sm">{hoveredThreat.name}</p>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-xs">
                {hoveredThreat.severity}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {hoveredThreat.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Asset: {hoveredThreat.asset}
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
