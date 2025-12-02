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

// Main request handler with proper MCP JSON-RPC
exports.handler = async function(event, context) {
  const { httpMethod, body, headers, requestContext } = event;

  // Log every request for debugging
  console.log('MCP REQUEST:', JSON.stringify({
    timestamp: new Date().toISOString(),
    method: httpMethod,
    path: headers.host + (requestContext.path || ''),
    userAgent: headers['user-agent'] || 'unknown'
  }, null, 2));

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
    const request = JSON.parse(body);
    console.log('MCP METHOD:', JSON.stringify({
      timestamp: new Date().toISOString(),
      method: request.method,
      id: request.id,
      hasParams: !!request.params
    }, null, 2));

    // Add CORS headers to all responses
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    // Handle getModels request (Claude Desktop discovery)
    if (request.method === 'getModels') {
      console.log('MCP GETMODELS: Success');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          models: [
            {
              id: "dflow-prediction-markets",
              name: "DFlow Prediction Markets",
              description: "Access prediction market events, markets, trades, and live data",
              provider: "dflow-mcp-server",
              capabilities: ["tools", "text-generation"]
            }
          ]
        }
      };
      console.log('MCP GETMODELS RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Handle connectMCPServer request (Claude Desktop connection method)
    if (request.method === 'connectMCPServer') {
      console.log('MCP CONNECT: Processing request');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          name: SERVER_INFO.serverInfo.name,
          version: SERVER_INFO.serverInfo.version,
          description: SERVER_INFO.serverInfo.description,
          capabilities: SERVER_INFO.capabilities,
          tools: TOOLS.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          })),
          connected: true,
          server_url: "https://dflow.opensvm.com/api/mcp",
          status: "connected",
          timestamp: new Date().toISOString()
        }
      };
      console.log('MCP CONNECT RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Handle initialize request (MCP spec)
    if (request.method === 'initialize') {
      console.log('MCP INITIALIZE: Success');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: SERVER_INFO
      };
      console.log('MCP INITIALIZE RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Handle tools/list request (MCP standard)
    if (request.method === 'tools/list') {
      console.log('MCP TOOLS/LIST: Success');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: TOOLS
        }
      };
      console.log('MCP TOOLS/LIST RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Handle tools/call request (MCP standard)
    if (request.method === 'tools/call') {
      console.log('MCP TOOLS/CALL: Starting');
      const { name, arguments: args } = request.params;
      const toolArgs = args || {};

      let result;
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

        const response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };
        console.log('MCP TOOLS/CALL SUCCESS:', JSON.stringify(response, null, 2));
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(response)
        };
      } catch (error) {
        console.log('MCP TOOLS/CALL ERROR:', JSON.stringify({
          tool: name,
          arguments: toolArgs,
          error: error.message
        }, null, 2));
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: error.message,
              data: {
                tool: name,
                arguments: toolArgs
              }
            }
          })
        };
      }
    }

    // Handle tools/describe request (optional MCP spec)
    if (request.method === 'tools/describe') {
      console.log('MCP TOOLS/DESCRIBE: Success');
      const toolName = request.params.name;
      const tool = TOOLS.find(t => t.name === toolName);
      
      if (!tool) {
        const errorResult = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: `Tool not found: ${toolName}`
          }
        };
        console.log('MCP TOOLS/DESCRIBE ERROR:', JSON.stringify(errorResult, null, 2));
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(errorResult)
        };
      }

      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: tool
      };
      console.log('MCP TOOLS/DESCRIBE RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Handle server/info request
    if (request.method === 'server/info') {
      console.log('MCP SERVER/INFO: Success');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: SERVER_INFO
      };
      console.log('MCP SERVER/INFO RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Add health check method
    if (request.method === 'health') {
      console.log('MCP HEALTH: Check');
      const result = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: SERVER_INFO.serverInfo.version,
          methods: [
            'getModels',
            'connectMCPServer',
            'initialize',
            'tools/list',
            'tools/call',
            'tools/describe',
            'server/info',
            'health'
          ]
        }
      };
      console.log('MCP HEALTH RESPONSE:', JSON.stringify(result, null, 2));
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }

    // Method not found - Log what was attempted
    console.log('MCP METHOD NOT FOUND:', JSON.stringify({
      attempted: request.method,
      id: request.id,
      available: [
        'getModels',
        'connectMCPServer',
        'initialize',
        'tools/list',
        'tools/call',
        'tools/describe',
        'server/info',
        'health'
      ]
    }, null, 2));
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: 'Method not found',
          data: {
            available_methods: [
              'getModels',
              'connectMCPServer',
              'initialize',
              'tools/list',
              'tools/call',
              'tools/describe',
              'server/info',
              'health'
            ]
          }
        }
      })
    };

  } catch (error) {
    console.log('MCP PARSE ERROR:', JSON.stringify({
      message: error.message,
      stack: error.stack
    }, null, 2));
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: 'Parse error or internal error',
          data: error.message
        }
      })
    };
  }
};