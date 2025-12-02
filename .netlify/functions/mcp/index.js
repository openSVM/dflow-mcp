const BASE_URL = 'https://api.llm.dflow.org';

// API client function
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

// Tool definitions with proper MCP schema
const TOOLS = [
  {
    name: 'get_events',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Maximum number of events to return (0-100)'
        },
        cursor: {
          type: 'integer',
          minimum: 0,
          description: 'Pagination cursor for fetching next page'
        }
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
        limit: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Number of markets to return (0-100)'
        },
        cursor: {
          type: 'integer',
          minimum: 0,
          description: 'Pagination cursor for fetching next page'
        }
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
        limit: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Number of trades to return (0-100)'
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor for fetching next page'
        }
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
        mint: {
          type: 'string',
          description: 'Token mint address to look up market'
        }
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
        event_ticker: {
          type: 'string',
          description: 'Event ticker for live data'
        },
        market_ticker: {
          type: 'string',
          description: 'Market ticker for live data'
        }
      },
      required: []
    }
  }
];

// Server info for MCP protocol
const SERVER_INFO = {
  protocolVersion: '2025-06-18',
  capabilities: {
    tools: {
      listChanged: false
    },
    prompts: {},
    resources: {}
  },
  serverInfo: {
    name: 'dflow-mcp-server',
    version: '1.0.0',
    description: 'Prediction Market Metadata API server for DFlow platform'
  }
};

// Claude Desktop specific handlers
const claudeDesktopHandlers = {
  connectMCPServer: async (request) => {
    const [serverUrl, nullParam] = request.args;
    
    console.log(`CLAUDE DESKTOP: connectMCPServer`);
    console.log(`URL: ${serverUrl}`);
    console.log(`ID: ${request.id}`);
    
    // Return Claude Desktop expected format
    const response = {
      success: true,
      connected: true,
      name: SERVER_INFO.serverInfo.name,
      version: SERVER_INFO.serverInfo.version,
      description: SERVER_INFO.serverInfo.description,
      capabilities: SERVER_INFO.capabilities,
      tools: TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      server_url: serverUrl || "https://dflow.opensvm.com/api/mcp",
      status: "connected",
      timestamp: new Date().toISOString(),
      transport: "claude_desktop_rpc",
      prompts: [],
      resources: [],
      protocolVersion: SERVER_INFO.protocolVersion
    };
    
    console.log(`CLAUDE RESPONSE: ${JSON.stringify(response, null, 2)}`);
    
    return response;
  },

  getModels: async (request) => {
    return {
      success: true,
      models: [
        {
          id: "dflow-prediction-markets",
          name: "DFlow Prediction Markets",
          description: "Access prediction market events, markets, trades, and live data",
          provider: "dflow-mcp-server",
          capabilities: ["tools", "text-generation"]
        }
      ]
    };
  },

  'tools/list': async (request) => {
    return {
      success: true,
      tools: TOOLS
    };
  },

  'tools/call': async (request) => {
    const [toolName, args] = request.args;
    const toolArgs = args || {};

    console.log(`CLAUDE TOOL CALL: ${toolName}`);
    console.log(`ARGS: ${JSON.stringify(toolArgs)}`);

    let result;
    try {
      switch (toolName) {
        case 'get_events':
          result = await apiRequest('GET', '/api/v1/events', toolArgs);
          break;
        case 'get_markets':
          result = await apiRequest('GET', '/api/v1/markets', toolArgs);
          break;
        case 'get_trades':
          result = await apiRequest('GET', '/api/v1/trades', toolArgs);
          break;
        case 'get_market_by_mint':
          result = await apiRequest('GET', `/api/v1/markets/by-mint/${toolArgs.mint}`);
          break;
        case 'get_live_data':
          const path = toolArgs.event_ticker 
            ? `/api/v1/events/live-data/${toolArgs.event_ticker}`
            : toolArgs.market_ticker 
            ? `/api/v1/markets/live-data/${toolArgs.market_ticker}`
            : '/api/v1/live-data';
          result = await apiRequest('GET', path);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        success: true,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: {
          tool: toolName,
          arguments: toolArgs
        }
      };
    }
  },

  initialize: async (request) => {
    return {
      success: true,
      ...SERVER_INFO
    };
  },

  health: async (request) => {
    return {
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: SERVER_INFO.serverInfo.version,
      methods: Object.keys(claudeDesktopHandlers),
      transport: "claude_desktop_rpc",
      tools_available: TOOLS.length
    };
  }
};

// Main request handler - Claude Desktop format
exports.handler = async function(event, context) {
  const { httpMethod, body, headers, requestContext } = event;
  const requestPath = requestContext.path || '';
  
  console.log(`MCP REQUEST: ${httpMethod} ${requestPath}`);
  console.log(`MCP BODY RAW: ${body}`);

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

  // Handle only POST requests for MCP
  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    let request;
    
    // Parse request
    try {
      request = JSON.parse(body);
      console.log(`MCP PARSED: ${JSON.stringify(request, null, 2)}`);
    } catch (parseError) {
      console.log(`MCP PARSE ERROR: ${parseError.message}`);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON format'
        })
      };
    }

    // Add CORS headers to all responses
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Content-Type': 'application/json'
    };

    // Check if this is Claude Desktop format (has 'args' array)
    if (request.args && Array.isArray(request.args) && request.method && request.type === 'rpc') {
      console.log(`MCP CLAUDE DESKTOP FORMAT: ${request.method}`);
      
      const methodName = request.method;
      if (claudeDesktopHandlers[methodName]) {
        const response = await claudeDesktopHandlers[methodName](request);
        
        console.log(`MCP CLAUDE RESPONSE: ${JSON.stringify(response, null, 2)}`);
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(response)
        };
      }
    }

    // Method not found - provide helpful error
    const errorResponse = {
      success: false,
      error: 'Method not found',
      data: {
        available_methods: Object.keys(claudeDesktopHandlers),
        request_detected: request.args ? 'claude_desktop' : 'unknown',
        formats_supported: ['claude_desktop_rpc'],
        claude_desktop_example: {
          args: ['https://dflow.opensvm.com/api/mcp', null],
          id: 'request_id',
          method: 'connectMCPServer',
          type: 'rpc'
        }
      }
    };
    
    console.log(`MCP ERROR RESPONSE: ${JSON.stringify(errorResponse, null, 2)}`);
    
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(errorResponse)
    };

  } catch (error) {
    const errorResponse = {
      success: false,
      error: 'Internal error',
      data: error.message
    };
    
    console.log(`MCP INTERNAL ERROR: ${JSON.stringify(errorResponse, null, 2)}`);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorResponse)
    };
  }
};
