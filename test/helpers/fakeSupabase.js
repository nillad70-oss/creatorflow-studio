// In-memory stand-in for the Supabase client used by the API routes.
// No network calls are ever made. Tests seed `state` and inspect it afterwards.

export const state = {
  tables: {},      // { tableName: [rows] }
  tokens: {},      // { accessToken: { id, email } }
  rpc: {},         // { fnName: (args) => data }
  storage: {},     // { bucket: { path: Buffer } }
  failInserts: {}, // { tableName: errorMessage }
}

export function resetState() {
  state.tables = {}
  state.tokens = {}
  state.rpc = {}
  state.storage = {}
  state.failInserts = {}
}

let idCounter = 0
const newId = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`

function rows(table) {
  if (!state.tables[table]) state.tables[table] = []
  return state.tables[table]
}

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.mode = 'select'
    this.payload = null
    this.wantSingle = false
    this.wantSelect = false
    this.orderBy = null
    this.limitN = null
  }
  select() { this.wantSelect = true; return this }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this }
  order(col, opts = {}) { this.orderBy = { col, asc: opts.ascending !== false }; return this }
  limit(n) { this.limitN = n; return this }
  single() { this.wantSingle = true; return this }
  maybeSingle() { this.wantSingle = 'maybe'; return this }
  insert(payload) { this.mode = 'insert'; this.payload = payload; return this }
  update(payload) { this.mode = 'update'; this.payload = payload; return this }
  upsert(payload, opts = {}) { this.mode = 'upsert'; this.payload = payload; this.upsertOpts = opts; return this }
  delete() { this.mode = 'delete'; return this }

  run() {
    const table = rows(this.table)
    const match = (r) => this.filters.every((f) => f(r))

    if (this.mode === 'insert') {
      if (state.failInserts[this.table]) return { data: null, error: { message: state.failInserts[this.table] } }
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload])
        .map((p) => ({ id: newId(), created_at: new Date().toISOString(), ...p }))
      table.push(...list)
      return this.finish(list)
    }
    if (this.mode === 'update') {
      const hit = table.filter(match)
      hit.forEach((r) => Object.assign(r, this.payload))
      return this.finish(hit)
    }
    if (this.mode === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload]
      const keys = (this.upsertOpts.onConflict || 'id').split(',').map((s) => s.trim())
      const out = list.map((p) => {
        const existing = table.find((r) => keys.every((k) => r[k] === p[k]))
        if (existing) { Object.assign(existing, p); return existing }
        const row = { id: newId(), ...p }
        table.push(row)
        return row
      })
      return this.finish(out)
    }
    if (this.mode === 'delete') {
      const keep = table.filter((r) => !match(r))
      state.tables[this.table] = keep
      return { data: null, error: null }
    }
    let out = table.filter(match)
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1))
    }
    if (this.limitN != null) out = out.slice(0, this.limitN)
    return this.finish(out)
  }

  finish(list) {
    if (this.wantSingle === true) {
      if (list.length !== 1) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      return { data: list[0], error: null }
    }
    if (this.wantSingle === 'maybe') return { data: list[0] || null, error: null }
    return { data: list, error: null }
  }

  then(resolve, reject) {
    try { resolve(this.run()) } catch (e) { reject(e) }
  }
}

export function makeClient() {
  return {
    from: (table) => new Query(table),
    rpc: async (name, args) => {
      const fn = state.rpc[name]
      if (!fn) return { data: null, error: { message: `rpc ${name} not mocked` } }
      return { data: fn(args), error: null }
    },
    auth: {
      getUser: async (token) => {
        const user = token ? state.tokens[token] : null
        if (!user) return { data: { user: null }, error: { message: 'invalid JWT' } }
        return { data: { user }, error: null }
      },
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, buf) => {
          state.storage[bucket] = state.storage[bucket] || {}
          state.storage[bucket][path] = buf
          return { data: { path }, error: null }
        },
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.test/${bucket}/${path}` }, error: null }),
        remove: async (paths) => {
          paths.forEach((p) => { if (state.storage[bucket]) delete state.storage[bucket][p] })
          return { data: null, error: null }
        },
      }),
    },
  }
}
