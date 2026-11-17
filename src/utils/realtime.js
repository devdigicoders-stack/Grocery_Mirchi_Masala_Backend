// backend/src/utils/realtime.js
const clients = new Set()

/**
 * Handle new SSE client connection
 * @route GET /api/demands/live-stream
 */
export const handleRealtimeConnection = (req, res) => {
  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // Disables response buffering in proxies
  })

  // Prevent connection timeout by sending comment heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch (_) {
      clearInterval(heartbeatInterval)
      clients.delete(res)
    }
  }, 15000)

  // Send initial connected event
  const initialPayload = JSON.stringify({
    type: 'CONNECTED',
    message: 'Real-time live stream connected',
    timestamp: new Date().toISOString()
  })
  res.write(`data: ${initialPayload}\n\n`)

  clients.add(res)
  console.log(`🔌 [Realtime SSE] Client connected. Total active clients: ${clients.size}`)

  req.on('close', () => {
    clearInterval(heartbeatInterval)
    clients.delete(res)
    console.log(`🔌 [Realtime SSE] Client disconnected. Total active clients: ${clients.size}`)
  })
}

/**
 * Broadcast event to all connected clients
 */
export const broadcastRealtimeEvent = (eventType, data = {}) => {
  const payload = JSON.stringify({
    type: eventType,
    data,
    timestamp: new Date().toISOString()
  })
  const message = `data: ${payload}\n\n`

  console.log(`📢 [Realtime SSE] Broadcasting '${eventType}' to ${clients.size} clients:`, eventType)
  for (const client of clients) {
    try {
      client.write(message)
    } catch (err) {
      clients.delete(client)
    }
  }
}
