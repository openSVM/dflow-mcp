// MCP v2 with Server-Sent Events (SSE) Support
// Based on mcp-remote package patterns

const BASE_URL = 'https://api.llm.dflow.org';

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

// Server info for MCP v2 protocol with SSE
const SERVER_INFO = {
  protocolVersion: '2025-06-18',
  capabilities: {
    tools: {
      listChanged: false
    },
    prompts: {},
    resources: {},
    sse: true // Add SSE capability
  },
  serverInfo: {
    name: 'dflow-mcp-server',
    version: '1.0.0',
    description: 'Prediction Market Metadata API server for DFlow platform with SSE support'
  }
};

// SSE Event formatter
function formatSSEEvent(type, data, id = null) {
  let event = '';
  if (id) event += `id: ${id}\n`;
  if (type) event += `event: ${type}\n`;
  event += `data: ${JSON.stringify(data)}\n\n`;
  return event;
}

// SSE Response helper
function createSSEResponse(events, requestId = null) {
  let response = '';
  
  events.forEach(event => {
    response += formatSSEEvent(event.type, event.data, requestId);
  });
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Last-Event-ID',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering for SSE
    },
    body: response
  };
}

// API client function with streaming support
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

// Bootstrap response with SSE capabilities
async function handleBootstrap(request) {
  console.log(`🚀 MCP V2 SSE: Bootstrap requested`);
  
  const response = {
    jsonrpc: "2.0",
    id: request.id || "bootstrap-response",
    result: {
      name: SERVER_INFO.serverInfo.name,
      version: SERVER_INFO.serverInfo.version,
      description: SERVER_INFO.serverInfo.description,
      protocolVersion: SERVER_INFO.protocolVersion,
      capabilities: SERVER_INFO.capabilities,
      serverInfo: SERVER_INFO.serverInfo,
      tools: TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      prompts: [],
      resources: [],
      connected: true,
      server_url: "https://dflow.opensvm.com/mcp/v2",
      status: "connected",
      timestamp: new Date().toISOString(),
      transport: "http_post_with_sse",
      implementation: "netlify-functions-mcp-v2-sse",
      sse: {
        supported: true,
        endpoint: "/mcp/v2/events",
        keep_alive: true,
        retry_time: 3000
      },
      endpoints: {
        bootstrap: "/mcp/v2/bootstrap",
        events: "/mcp/v2/events",
        tools_list: "/mcp/v2/tools/list",
        tools_call: "/mcp/v2/tools/call"
      }
    }
  };
  
  console.log(`✅ MCP V2 SSE BOOTSTRAP: ${JSON.stringify(response, null, 2)}`);
  
  return response;
}

// SSE Events handler
async function handleSSEEvents(request) {
  console.log(`📡 MCP V2 SSE: Events stream requested`);
  
  const requestId = `sse-${Date.now()}`;
  const events = [
    {
      type: 'connected',
      data: {
        status: 'connected',
        server: SERVER_INFO.serverInfo.name,
        timestamp: new Date().toISOString()
      }
    },
    {
      type: 'tools_available',
      data: {
        tools: TOOLS,
        count: TOOLS.length
      }
    },
    {
      type: 'ready',
      data: {
        status: 'ready',
        capabilities: SERVER_INFO.capabilities,
        transport: 'sse'
      }
    }
  ];
  
  return createSSEResponse(events, requestId);
}

// Tools list with SSE support
async function handleToolsList(request) {
  console.log(`🛠️ MCP V2 SSE: tools/list`);
  
  const response = {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      tools: TOOLS,
      transport: "sse_supported",
      streaming: true
    }
  };
  
  return response;
}

// Tools call with streaming response
async function handleToolsCall(request) {
  const { name, arguments: args } = request.params;
  const toolArgs = args || {};

  console.log(`🔧 MCP V2 SSE: tools/call - ${name}`);
  console.log(`📝 Args: ${JSON.stringify(toolArgs)}`);

  try {
    switch (name) {
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
        throw new Error(`Unknown tool: ${name}`);
    }

    // Return streaming response
    const requestId = `tool-${Date.now()}`;
    const events = [
      {
        type: 'tool_started',
        data: {
          tool: name,
          arguments: toolArgs
        }
      },
      {
        type: 'tool_result',
        data: {
          tool: name,
          result: result,
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      },
      {
        type: 'tool_completed',
        data: {
          tool: name,
          success: true
        }
      }
    ];
    
    return createSSEResponse(events, requestId);
    
  } catch (error) {
    const requestId = `tool-error-${Date.now()}`;
    const events = [
      {
        type: 'tool_started',
        data: {
          tool: name,
          arguments: toolArgs
        }
      },
      {
        type: 'tool_error',
        data: {
          tool: name,
          error: error.message,
          arguments: toolArgs
        }
      },
      {
        type: 'tool_completed',
        data: {
          tool: name,
          success: false
        }
      }
    ];
    
    return createSSEResponse(events, requestId);
  }
}

// Main handler with SSE support
exports.handler = async function(event, context) {
  const { httpMethod, body, headers, requestContext } = event;
  const requestPath = requestContext.path || '';
  
  console.log(`🌟 MCP V2 SSE: ${httpMethod} ${requestPath}`);
  console.log(`📦 MCP V2 SSE BODY: ${body}`);

  // Handle OPTIONS for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Last-Event-ID',
        'Access-Control-Max-Age': '86400',
      }
    };
  }

  // Handle SSE endpoint for GET requests (event stream)
  if (httpMethod === 'GET' && requestPath === '/mcp/v2/events') {
    return await handleSSEEvents();
  }

  // Handle only POST requests for MCP operations
  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: 'Method not allowed'
        }
      })
    };
  }

  try {
    let request;
    
    // Parse request
    try {
      request = JSON.parse(body);
      console.log(`📋 MCP V2 SSE PARSED: ${JSON.stringify(request, null, 2)}`);
    } catch (parseError) {
      console.log(`💥 MCP V2 SSE PARSE ERROR: ${parseError.message}`);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: parseError.message
          }
        })
      };
    }

    // Standard CORS headers
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Last-Event-ID',
      'Content-Type': 'application/json'
    };

    // Route to appropriate handler
    let response;
    
    if (requestPath === '/mcp/v2/bootstrap') {
      console.log(`🚀 MCP V2 SSE: Bootstrap handler called`);
      response = await handleBootstrap(request);
    } else if (request.method === 'tools/list') {
      response = await handleToolsList(request);
    } else if (request.method === 'tools/call') {
      response = await handleToolsCall(request);
    } else {
      // Method not found
      response = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: 'Method not found',
          data: {
            available_methods: ['bootstrap', 'tools/list', 'tools/call'],
            sse_endpoint: '/mcp/v2/events',
            format: 'mcp_v2_sse'
          }
        }
      };
    }

    console.log(`📤 MCP V2 SSE RESPONSE: ${JSON.stringify(response, null, 2)}`);
    
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    };
    
    console.log(`💥 MCP V2 SSE INTERNAL ERROR: ${JSON.stringify(errorResponse, null, 2)}`);
    
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