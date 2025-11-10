/**
 * CORS headers for API routes
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // In production, replace with specific origin
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

