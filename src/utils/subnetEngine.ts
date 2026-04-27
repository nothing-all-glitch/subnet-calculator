import type { VlsmAllocation, VlsmResult } from '../types/subnet'
import { broadcastOf, networkOf, subnetDetailsFor, usableHostCountForPrefix } from './ipMath'

function alignToBlock(start: number, blockSize: number): number {
  const remainder = start % blockSize
  if (remainder === 0) return start >>> 0
  return (start + (blockSize - remainder)) >>> 0
}

export function parseHostRequirements(input: string): { values: number[]; error?: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    return { values: [], error: 'Provide at least one host requirement.' }
  }

  if (/[a-z]/i.test(trimmed)) {
    return { values: [], error: 'Host requirements must be positive integers.' }
  }

  const matches = trimmed.match(/\d+/g)
  if (!matches || matches.length === 0) {
    return { values: [], error: 'Provide at least one host requirement.' }
  }

  const values = matches.map((match) => Number.parseInt(match, 10))

  if (values.some((value) => Number.isNaN(value) || value <= 0)) {
    return { values: [], error: 'Host requirements must be positive integers.' }
  }

  return { values }
}

export function requiredPrefixForHosts(
  requiredHosts: number,
  options: { prefer31PointToPoint?: boolean } = {},
): number {
  if (requiredHosts <= 0) {
    throw new Error('Host requirement must be positive.')
  }

  if (requiredHosts === 1) return 32
  if (requiredHosts === 2 && options.prefer31PointToPoint) return 31

  let hostBits = 2
  while (2 ** hostBits - 2 < requiredHosts) {
    hostBits += 1
  }

  return 32 - hostBits
}

export function allocateVlsm(
  ip: number,
  basePrefix: number,
  requirements: number[],
  options: { prefer31PointToPoint?: boolean } = {},
): VlsmResult {
  const baseNetwork = networkOf(ip, basePrefix)
  const baseBroadcast = broadcastOf(ip, basePrefix)
  const sorted = [...requirements].sort((left, right) => right - left)

  const rows: VlsmAllocation[] = []
  let cursor = baseNetwork

  for (const requestedHosts of sorted) {
    const prefix = requiredPrefixForHosts(requestedHosts, options)
    const blockSize = 2 ** (32 - prefix)
    const network = alignToBlock(cursor, blockSize)
    const broadcast = (network + blockSize - 1) >>> 0

    if (broadcast > baseBroadcast) {
      return {
        rows: [],
        error: 'Insufficient address space for all requested subnets.',
      }
    }

    const details = subnetDetailsFor(network, prefix)
    rows.push({
      requestedHosts,
      prefix,
      blockSize,
      usableHostCount: usableHostCountForPrefix(prefix),
      network: details.network,
      broadcast: details.broadcast,
      firstUsable: details.firstUsable,
      lastUsable: details.lastUsable,
    })

    cursor = (broadcast + 1) >>> 0
  }

  return { rows }
}
