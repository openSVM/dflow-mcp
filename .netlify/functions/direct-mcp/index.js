// Redirect handler to fix wrong path
exports.handler = async function(event, context) {
  const { requestContext } = event;
  
  return {
    statusCode: 301,
    headers: {
      'Location': 'https://dflow.opensvm.com/api/mcp',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({
      error: 'Wrong path detected',
      correct_path: '/api/mcp',
      wrong_path: '/.netlify/functions/mcp',
      redirect: 'https://dflow.opensvm.com/api/mcp'
    })
  };
};