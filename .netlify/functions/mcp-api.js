// Simple working MCP API function
const BASE_URL = 'https://api.llm.dflow.org';

async function apiRequest(method, path, params) {
  const url = new URL(path, BASE_URL);
  if (params && method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: method === 'POST' && params ? JSON.stringify(params) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

const TOOLS = [
  {
    name: 'get_events',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, maximum: 100, description: 'Maximum number of events to return (0-100)' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor for fetching next page' }
      },
      required: []
    }
  },
  {
    name: 'get_markets',
    description: 'Get a paginated list of markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, maximum: 100, description: 'Number of markets to return (0-100)' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor for fetching next page' }
      },
      required: []
    }
  },
  {
    name: 'get_trades',
    description: 'Get a paginated list of trades across markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, maximum: 100, description: 'Number of trades to return (0-100)' },
        cursor: { type: 'string', description: 'Pagination cursor for fetching next page' }
      },
      required: []
    }
  },
  {
    name: 'get_market_by_mint',
    description: 'Get market details by token mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address to look up market' }
      },
      required: ['mint']
    }
  },
  {
    name: 'get_live_data',
    description: 'Get live data for events and markets.',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string', description: 'Event ticker for live data' },
        market_ticker: { type: 'string', description: 'Market ticker for live data' }
      },
      required: []
    }
  }
];

const SERVER_INFO = {
  protocolVersion: '2025-06-18',
  capabilities: {
    tools: { listChanged: false },
    prompts: {},
    resources: {}
  },
  serverInfo: {
    name: 'dflow-mcp-server',
    version: '1.0.0',
    description: 'Prediction Market Metadata API server for DFlow platform'
  }
};

// Main handler
exports.handler = async function(event, context) {
  const { httpMethod, body, headers, requestContext } = event;
  const requestPath = requestContext.path || '';
  
  console.log(`MCP: ${httpMethod} ${requestPath}`);
  console.log(`BODY: ${body}`);

  // Handle OPTIONS for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Max-Age': '86400',
      }
    };
  }

  // Handle only POST requests
  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0", id: null, error: { code: -32600, message: 'Method not allowed' }
      })
    };
  }

  try {
    const request = JSON.parse(body);
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Content-Type': 'application/json'
    };

    let response;

    // Handle standard JSON-RPC methods
    if (request.jsonrpc === '2.0' && request.method) {
      switch (request.method) {
        case 'initialize':
          response = {
            jsonrpc: "2.0", id: request.id,
            result: SERVER_INFO
          };
          break;

        case 'tools/list':
          response = {
            jsonrpc: "2.0", id: request.id,
            result: { tools: TOOLS }
          };
          break;

        case 'tools/call':
          const { name, arguments: args } = request.params;
          let result;
          
          try {
            switch (name) {
              case 'get_events': result = await apiRequest('GET', '/api/v1/events', args); break;
              case 'get_markets': result = await apiRequest('GET', '/api/v1/markets', args); break;
              case 'get_trades': result = await apiRequest('GET', '/api/v1/trades', args); break;
              case 'get_market_by_mint': result = await apiRequest('GET', `/api/v1/markets/by-mint/${args.mint}`); break;
              case 'get_live_data':
                const path = args.event_ticker ? `/api/v1/events/live-data/${args.event_ticker}`
                          : args.market_ticker ? `/api/v1/markets/live-data/${args.market_ticker}`
                          : '/api/v1/live-data';
                result = await apiRequest('GET', path, args);
                break;
              default: throw new Error(`Unknown tool: ${name}`);
            }
            
            response = {
              jsonrpc: "2.0", id: request.id,
              result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
            };
          } catch (error) {
            response = {
              jsonrpc: "2.0", id: request.id,
              error: { code: -32603, message: error.message, data: { tool: name, arguments: args } }
            };
          }
          break;

        default:
          response = {
            jsonrpc: "2.0", id: request.id,
            error: { code: -32601, message: 'Method not found', data: { available_methods: ['initialize', 'tools/list', 'tools/call'] } }
          };
      }
    } else {
      response = {
        jsonrpc: "2.0", id: request.id,
        error: { code: -32600, message: 'Invalid request format' }
      };
    }

    console.log(`RESPONSE: ${JSON.stringify(response, null, 2)}`);
    
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.log(`ERROR: ${error.message}`);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: null,
        error: { code: -32603, message: 'Internal error', data: error.message }
      })
    };
  }
};
