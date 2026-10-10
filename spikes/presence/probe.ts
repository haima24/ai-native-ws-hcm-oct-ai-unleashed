import { createClient } from '@supabase/supabase-js'

type Role = 'host' | 'guest'
type LogEntry = { t: number; type: string; [key: string]: unknown }

declare global {
  interface Window {
    __log: LogEntry[]
    __me: { participantId: string; role: Role }
    __ready: boolean
    __sendJoinIntent: (seq: number) => Promise<string>
  }
}

const params = new URLSearchParams(location.search)
const role: Role = params.get('role') === 'host' ? 'host' : 'guest'
const participantId = params.get('id') ?? `${role}-${crypto.randomUUID().slice(0, 8)}`
const displayName = params.get('name') ?? participantId
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

window.__log = []
window.__me = { participantId, role }
window.__ready = false

const log = (type: string, extra: Record<string, unknown> = {}) => {
  window.__log.push({ t: Date.now(), type, ...extra })
}

if (!url || !anonKey) {
  log('error', { message: 'missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' })
} else {
  const client = createClient(url, anonKey)
  const channel = client.channel('story-pointing:SPIKE01', {
    config: { broadcast: { self: false, ack: true }, presence: { key: participantId } },
  })

  channel.on('presence', { event: 'sync' }, () => {
    log('sync', { keys: Object.keys(channel.presenceState()) })
  })
  channel.on('presence', { event: 'join' }, ({ key }) => log('join', { key }))
  channel.on('presence', { event: 'leave' }, ({ key }) => log('leave', { key }))

  channel.on('broadcast', { event: 'room:join-intent' }, ({ payload }) => {
    log('broadcast-in', { event: 'room:join-intent', payload })
    if (role === 'host') {
      void channel
        .send({
          type: 'broadcast',
          event: 'room:join-accepted',
          payload: { seq: payload.seq, to: payload.participantId },
        })
        .then((status) => log('broadcast-ack', { event: 'room:join-accepted', status }))
    }
  })
  channel.on('broadcast', { event: 'room:join-accepted' }, ({ payload }) => {
    log('broadcast-in', { event: 'room:join-accepted', payload })
  })

  window.__sendJoinIntent = async (seq) => {
    const status = await channel.send({
      type: 'broadcast',
      event: 'room:join-intent',
      payload: { seq, participantId },
    })
    log('broadcast-ack', { event: 'room:join-intent', status, seq })
    return status
  }

  channel.subscribe(async (status) => {
    log('status', { status })
    if (status === 'SUBSCRIBED') {
      const result = await channel.track({ participantId, displayName, role })
      log('tracked', { result })
      window.__ready = true
    }
  })
}

document.getElementById('out')!.textContent = `presence probe: ${role} ${participantId}`
