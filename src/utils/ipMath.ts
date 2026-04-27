import type { BitValue, NetworkClassification, SubnetDetails } from '../types/subnet'

const MAX_UINT32 = 0xffffffff

export function parseIPv4(input: string): number | null {
  const parts = input.trim().split('.')
  if (parts.length !== 4) return null

  const octets = parts.map((part) => Number.parseInt(part, 10))
  if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null
  }

  return (
    (((octets[0] << 24) >>> 0) |
      ((octets[1] << 16) >>> 0) |
      ((octets[2] << 8) >>> 0) |
      octets[3]) >>>
    0
  )
}

export function parseCidr(input: string): { ip: number; prefix: number } | null {
  const [ipRaw, prefixRaw] = input.trim().split('/')
  if (!ipRaw || !prefixRaw) return null

  const ip = parseIPv4(ipRaw)
  const prefix = Number.parseInt(prefixRaw, 10)
  if (ip === null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return null
  }

  return { ip, prefix }
}

export function intToIPv4(value: number): string {
  const ip = value >>> 0
  return [
    (ip >>> 24) & 255,
    (ip >>> 16) & 255,
    (ip >>> 8) & 255,
    ip & 255,
  ].join('.')
}

export function intToBits32(value: number): BitValue[] {
  const bits: BitValue[] = []
  const ip = value >>> 0

  for (let index = 31; index >= 0; index -= 1) {
    bits.push(((ip >>> index) & 1) as BitValue)
  }

  return bits
}

export function bitsToInt(bits: BitValue[]): number {
  return bits.reduce<number>((accumulator, bit) => ((accumulator << 1) | bit) >>> 0, 0)
}

export function prefixToMask(prefix: number): number {
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix: ${prefix}`)
  }

  if (prefix === 0) return 0
  return (MAX_UINT32 << (32 - prefix)) >>> 0
}

export function wildcardMaskFromPrefix(prefix: number): number {
  return (~prefixToMask(prefix)) >>> 0
}

export function networkOf(ip: number, prefix: number): number {
  const mask = prefixToMask(prefix)
  return (ip & mask) >>> 0
}

export function broadcastOf(ip: number, prefix: number): number {
  const network = networkOf(ip, prefix)
  const mask = prefixToMask(prefix)
  return (network | (~mask >>> 0)) >>> 0
}

export function usableHostCountForPrefix(prefix: number): number {
  if (prefix === 32) return 1
  if (prefix === 31) return 2
  return Math.max(0, 2 ** (32 - prefix) - 2)
}

export function subnetDetailsFor(ip: number, prefix: number): SubnetDetails {
  const network = networkOf(ip, prefix)
  const broadcast = broadcastOf(ip, prefix)

  let firstUsable = network
  let lastUsable = broadcast

  if (prefix <= 30) {
    firstUsable = (network + 1) >>> 0
    lastUsable = (broadcast - 1) >>> 0
  }

  return {
    ip: ip >>> 0,
    prefix,
    mask: prefixToMask(prefix),
    network,
    broadcast,
    firstUsable,
    lastUsable,
    usableHostCount: usableHostCountForPrefix(prefix),
  }
}

export function classifyIPv4(ip: number): NetworkClassification {
  const firstOctet = (ip >>> 24) & 255
  const secondOctet = (ip >>> 16) & 255

  const addressClass: NetworkClassification['addressClass'] =
    firstOctet <= 127 ? 'A' : firstOctet <= 191 ? 'B' : firstOctet <= 223 ? 'C' : firstOctet <= 239 ? 'D' : 'E'

  const isPrivate =
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)

  const isLoopback = firstOctet === 127
  const isLinkLocal = firstOctet === 169 && secondOctet === 254
  const isMulticast = firstOctet >= 224 && firstOctet <= 239
  const isReserved = firstOctet >= 240 || firstOctet === 0

  const category: NetworkClassification['category'] = isLoopback
    ? 'Loopback'
    : isLinkLocal
      ? 'Link-local'
      : isMulticast
        ? 'Multicast'
        : isReserved
          ? 'Reserved'
          : 'Unicast'

  return {
    addressClass,
    scope: isPrivate ? 'Private' : 'Public',
    category,
  }
}
