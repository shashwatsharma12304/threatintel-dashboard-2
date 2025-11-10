import { NextRequest, NextResponse } from 'next/server';
import { getRadarCollection } from '../../../lib/mongodb';
import { getCorsHeaders } from '../../../lib/cors';

const DEFAULT_CUSTOMER_ID = process.env.CUSTOMER_ID || 'cust-airtel-001';

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * Filter threats based on query parameters.
 */
function filterThreats(
  points: any[],
  searchParams: URLSearchParams
): any[] {
  let filtered = [...points];

  // Search filter
  const search = searchParams.get('search')?.toLowerCase();
  if (search) {
    filtered = filtered.filter(point => {
      const threatName = (point.threat_name || '').toLowerCase();
      const summary = (point.summary || '').toLowerCase();
      const source = (point.source || '').toLowerCase();
      const cveIds = (point.cve_ids || []).join(' ').toLowerCase();
      
      return threatName.includes(search) ||
             summary.includes(search) ||
             source.includes(search) ||
             cveIds.includes(search);
    });
  }

  // Severity filter
  const severities = searchParams.getAll('severity');
  if (severities.length > 0) {
    filtered = filtered.filter(point => 
      severities.includes(point.severity?.toLowerCase())
    );
  }

  // Status filter
  const statuses = searchParams.getAll('status');
  if (statuses.length > 0) {
    filtered = filtered.filter(point => 
      statuses.includes(point.status?.toLowerCase())
    );
  }

  // Asset filter
  const assets = searchParams.getAll('assets');
  if (assets.length > 0) {
    filtered = filtered.filter(point => {
      const assetsImpacted = point.assets_impacted || [];
      return assetsImpacted.some((asset: any) => 
        assets.includes(asset.product_name)
      );
    });
  }

  // Source filter
  const sources = searchParams.getAll('sources');
  if (sources.length > 0) {
    filtered = filtered.filter(point => 
      sources.includes(point.source)
    );
  }

  // Time range filter
  const timeRange = searchParams.get('timeRange');
  if (timeRange) {
    const now = new Date();
    let daysAgo: number;
    
    switch (timeRange) {
      case 'last24h':
        daysAgo = 1;
        break;
      case 'last7d':
        daysAgo = 7;
        break;
      case 'last30d':
        daysAgo = 30;
        break;
      default:
        daysAgo = Infinity;
    }

    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    filtered = filtered.filter(point => {
      const firstSeen = point.first_seen;
      if (!firstSeen) return false;
      
      try {
        const pointDate = new Date(firstSeen);
        return pointDate >= cutoffDate;
      } catch {
        return false;
      }
    });
  }

  return filtered;
}

/**
 * GET /api/threats
 * Get filtered threats from radar data.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id') || DEFAULT_CUSTOMER_ID;

    const collection = await getRadarCollection();
    
    // Get latest radar data
    const radarDoc = await collection.findOne(
      { 'meta.customer_id': customerId },
      { sort: { 'meta.generated_at': -1 } }
    );

    if (!radarDoc) {
      return NextResponse.json([], { headers: getCorsHeaders() });
    }

    const points = radarDoc.points || [];
    
    // Apply filters
    const filteredThreats = filterThreats(points, searchParams);

    return NextResponse.json(filteredThreats, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching threats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threats' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

