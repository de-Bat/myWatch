type Sender = (data: string) => void

export class SseBus {
  private connections = new Map<string, Map<string, Sender>>()

  subscribe(userId: string, connId: string, send: Sender): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map())
    }
    this.connections.get(userId)!.set(connId, send)
  }

  unsubscribe(userId: string, connId: string): void {
    this.connections.get(userId)?.delete(connId)
  }

  emit(userId: string, excludeConnId: string, data: { pushedAt: string }): void {
    const userConns = this.connections.get(userId)
    if (!userConns) return
    const payload = `event: sync\ndata: ${JSON.stringify(data)}\n\n`
    for (const [connId, send] of userConns) {
      if (connId !== excludeConnId) {
        try { send(payload) } catch { /* connection gone */ }
      }
    }
  }
}

export const sseBus = new SseBus()
