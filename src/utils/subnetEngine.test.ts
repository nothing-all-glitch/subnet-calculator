import { describe, expect, it } from 'vitest'
import { intToIPv4, parseIPv4 } from './ipMath'
import { allocateVlsm, parseHostRequirements, requiredPrefixForHosts } from './subnetEngine'

describe('requiredPrefixForHosts', () => {
  it('calculates expected prefixes for common host counts', () => {
    expect(requiredPrefixForHosts(64)).toBe(25)
    expect(requiredPrefixForHosts(45)).toBe(26)
    expect(requiredPrefixForHosts(14)).toBe(28)
    expect(requiredPrefixForHosts(9)).toBe(28)
    expect(requiredPrefixForHosts(2)).toBe(30)
  })
})

describe('allocateVlsm', () => {
  it('allocates non-overlapping subnets for the sample workload', () => {
    const baseIp = parseIPv4('192.168.5.0')
    if (baseIp === null) throw new Error('Could not parse test IP')

    const result = allocateVlsm(baseIp, 24, [64, 45, 14, 9, 2])
    expect(result.error).toBeUndefined()
    expect(result.rows.map((row) => `${intToIPv4(row.network)}/${row.prefix}`)).toEqual([
      '192.168.5.0/25',
      '192.168.5.128/26',
      '192.168.5.192/28',
      '192.168.5.208/28',
      '192.168.5.224/30',
    ])
  })

  it('returns an explicit overflow error when address space is not enough', () => {
    const baseIp = parseIPv4('10.0.0.0')
    if (baseIp === null) throw new Error('Could not parse test IP')

    const result = allocateVlsm(baseIp, 30, [20])
    expect(result.rows).toHaveLength(0)
    expect(result.error).toBe('Insufficient address space for all requested subnets.')
  })
})

describe('parseHostRequirements', () => {
  it('parses comma, space, and newline separated host values', () => {
    expect(parseHostRequirements('64,45 14\n9;2').values).toEqual([64, 45, 14, 9, 2])
    expect(parseHostRequirements('8 4 2').values).toEqual([8, 4, 2])
  })

  it('rejects non-numeric tokens', () => {
    expect(parseHostRequirements('64, x, 10').error).toBe(
      'Host requirements must be positive integers.',
    )
  })
})
