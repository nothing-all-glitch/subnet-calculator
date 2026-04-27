export type BitValue = 0 | 1

export interface SubnetDetails {
  ip: number
  prefix: number
  mask: number
  network: number
  broadcast: number
  firstUsable: number
  lastUsable: number
  usableHostCount: number
}

export interface VlsmRequest {
  requestedHosts: number
}

export interface VlsmAllocation {
  requestedHosts: number
  prefix: number
  blockSize: number
  usableHostCount: number
  network: number
  broadcast: number
  firstUsable: number
  lastUsable: number
}

export interface VlsmResult {
  rows: VlsmAllocation[]
  error?: string
}
