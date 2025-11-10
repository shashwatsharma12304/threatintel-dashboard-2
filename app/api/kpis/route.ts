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
 * GET /api/kpis
 * Calculate and return KPI data.
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
      return NextResponse.json({
        active: 0,
        critical: 0,
        high: 0,
        newLast24h: 0,
        assetsImpacted: 0
      }, { headers: getCorsHeaders() });
    }

    const points = radarDoc.points || [];
    
    // Calculate KPIs
    const active = points.filter((p: any) => 
      ['active', 'new'].includes(p.status?.toLowerCase())
    ).length;

    const critical = points.filter((p: any) => 
      p.severity?.toLowerCase() === 'critical' && 
      p.status?.toLowerCase() !== 'mitigated'
    ).length;

    const high = points.filter((p: any) => 
      p.severity?.toLowerCase() === 'high' && 
      p.status?.toLowerCase() !== 'mitigated'
    ).length;

    // New in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const newLast24h = points.filter((p: any) => {
      const firstSeen = p.first_seen;
      if (!firstSeen) return false;
      
      try {
        const pointDate = new Date(firstSeen);
        return pointDate > oneDayAgo;
      } catch {
        return false;
      }
    }).length;

    // Unique assets impacted
    const uniqueAssets = new Set<string>();
    points.forEach((p: any) => {
      const assetsImpacted = p.assets_impacted || [];
      assetsImpacted.forEach((asset: any) => {
        const productName = asset.product_name;
        if (productName) {
          uniqueAssets.add(productName);
        }
      });
    });

    const kpis = {
      active,
      critical,
      high,
      newLast24h,
      assetsImpacted: uniqueAssets.size
    };

    return NextResponse.json(kpis, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    return NextResponse.json(
      { error: 'Failed to calculate KPIs' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

