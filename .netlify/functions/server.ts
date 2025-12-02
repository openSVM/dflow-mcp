import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BASE_URL = 'https://api.llm.dflow.org';

// Simplified API client for serverless function
async function apiRequest(method: string, path: string, params?: any) {
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
];

// Main request handler
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Handle MCP JSON-RPC requests
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Handle tools.list
      if (body.method === 'tools.list' || body.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle tools.call
      if (body.method === 'tools.call' || body.method === 'tools/call') {
        const { name, arguments: args } = body.params;
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
            default:
              throw new Error(`Unknown tool: ${name}`);
          }

          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : String(error)
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Method not found
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: 'Method not found' }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: 'Parse error' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Serve static HTML page
  if (req.method === 'GET' && url.pathname === '/') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DFlow MCP Server | OpenSVM</title>
    <style>
        body {
            background: #000000;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1 {
            font-size: 32px;
            font-weight: 600;
            margin: 0 0 20px 0;
        }
        .status {
            color: #00ff00;
            font-size: 16px;
            margin: 20px 0;
            font-family: monospace;
        }
        .endpoint {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 20px;
            margin: 20px 0;
            font-family: monospace;
        }
        .test-btn {
            background: #ffffff;
            color: #000000;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            margin: 10px 5px;
            cursor: pointer;
        }
        .test-btn:hover {
            background: #cccccc;
        }
        #result {
            margin-top: 20px;
            background: rgba(255,255,255,0.05);
            padding: 15px;
            display: none;
        }
        pre {
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>DFlow MCP Server</h1>
        <div class="status">● MCP Server Online</div>
        
        <div class="endpoint">
            JSON-RPC Endpoint: ${url.origin}
        </div>

        <div>
            <button class="test-btn" onclick="testListTools()">List Tools</button>
            <button class="test-btn" onclick="testCallTool()">Get Events</button>
        </div>

        <div id="result">
            <strong>Response:</strong><br>
            <pre id="response"></pre>
        </div>
    </div>

    <script>
        async function testListTools() {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools.list",
                    params: {}
                })
            });
            const result = await response.json();
            showResult(result);
        }

        async function testCallTool() {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools.call",
                    params: {
                        name: "get_events",
                        arguments: { limit: 5 }
                    }
                })
            });
            const result = await response.json();
            showResult(result);
        }

        function showResult(result) {
            document.getElementById('result').style.display = 'block';
            document.getElementById('response').textContent = JSON.stringify(result, null, 2);
        }
    </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'dflow-mcp',
      version: '1.0.0',
      tools: TOOLS.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 404 for other paths
  return new Response('Not Found', { status: 404 });
}

serve(handler, { port: 8000 });