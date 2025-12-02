// MCP v2 Bootstrap Handler
// Claude Desktop calls /mcp/v2/bootstrap

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

// Server info for MCP v2 protocol
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

// Bootstrap response for Claude Desktop MCP v2
async function handleBootstrap(request) {
  console.log(`🚀 MCP V2: Bootstrap requested`);
  console.log(`📋 Request: ${JSON.stringify(request, null, 2)}`);
  
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
      transport: "http_post",
      implementation: "netlify-functions-mcp-v2",
      endpoints: {
        bootstrap: "/mcp/v2/bootstrap",
        connect: "/mcp/v2/connect", 
        tools_list: "/mcp/v2/tools/list",
        tools_call: "/mcp/v2/tools/call"
      }
    }
  };
  
  console.log(`✅ MCP V2 BOOTSTRAP RESPONSE: ${JSON.stringify(response, null, 2)}`);
  
  return response;
}

// Main handler for MCP v2 bootstrap
exports.handler = async function(event, context) {
  const { httpMethod, body, headers, requestContext } = event;
  const requestPath = requestContext.path || '';
  
  console.log(`🌟 MCP V2: ${httpMethod} ${requestPath}`);
  console.log(`📦 MCP V2 BODY: ${body}`);

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
      console.log(`📋 MCP V2 PARSED: ${JSON.stringify(request, null, 2)}`);
    } catch (parseError) {
      console.log(`💥 MCP V2 PARSE ERROR: ${parseError.message}`);
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

    // Add CORS headers to all responses
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Content-Type': 'application/json'
    };

    // Handle bootstrap request
    if (requestPath === '/mcp/v2/bootstrap') {
      console.log(`🚀 MCP V2: Bootstrap handler called`);
      const response = await handleBootstrap(request);
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(response)
      };
    }

    // Handle other potential MCP v2 methods
    if (request.method && requestPath.startsWith('/mcp/v2/')) {
      console.log(`🔧 MCP V2: Method ${request.method} on ${requestPath}`);
      
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          status: "mcp_v2_supported",
          method: request.method,
          path: requestPath,
          available_endpoints: [
            "/mcp/v2/bootstrap",
            "/mcp/v2/connect",
            "/mcp/v2/tools/list", 
            "/mcp/v2/tools/call"
          ],
          tools: TOOLS
        }
      };
      
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(response)
      };
    }

    // Method not found
    const errorResponse = {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32601,
        message: 'Method not found',
        data: {
          request_path: requestPath,
          available_endpoints: [
            "/mcp/v2/bootstrap",
            "/mcp/v2/connect",
            "/mcp/v2/tools/list",
            "/mcp/v2/tools/call"
          ],
          formats_supported: ['mcp_v2'],
          protocol_version: '2025-06-18'
        }
      }
    };
    
    console.log(`❌ MCP V2 ERROR RESPONSE: ${JSON.stringify(errorResponse, null, 2)}`);
    
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(errorResponse)
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
    
    console.log(`💥 MCP V2 INTERNAL ERROR: ${JSON.stringify(errorResponse, null, 2)}`);
    
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