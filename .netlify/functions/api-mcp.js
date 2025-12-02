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

// Tool definitions
const TOOLS = [
  {
    name: 'get_events',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Maximum number of events to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
      },
      required: [],
    },
  },
  {
    name: 'get_markets',
    description: 'Get a paginated list of markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of markets to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
      },
      required: [],
    },
  },
  {
    name: 'get_trades',
    description: 'Get a paginated list of trades across markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of trades to return' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
      required: [],
    },
  },
];

// Main request handler
exports.handler = async function(event, context) {
  const { httpMethod, body, headers } = event;

  // Handle only POST requests for MCP
  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const request = JSON.parse(body);

    // Handle tools.list
    if (request.method === 'tools.list' || request.method === 'tools/list') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: { tools: TOOLS }
        })
      };
    }

    // Handle tools.call
    if (request.method === 'tools.call' || request.method === 'tools/call') {
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
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          })
        };
      } catch (error) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: error.message
            }
          })
        };
      }
    }

    // Method not found
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: 'Method not found' }
      })
    };

  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: 'Parse error' }
      })
    };
  }
};