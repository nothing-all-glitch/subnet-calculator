import { describe, expect, it } from 'vitest'
import { classifyIPv4, parseIPv4, wildcardMaskFromPrefix } from './ipMath'

describe('wildcardMaskFromPrefix', () => {
  it('computes inverse mask correctly', () => {
    expect(wildcardMaskFromPrefix(24)).toBe(0x000000ff)
    expect(wildcardMaskFromPrefix(26)).toBe(0x0000003f)
  })
})

describe('classifyIPv4', () => {
  it('classifies private class C unicast correctly', () => {
    const ip = parseIPv4('192.168.1.10')
    if (ip === null) throw new Error('Could not parse test IP')
    expect(classifyIPv4(ip)).toEqual({
      addressClass: 'C',
      scope: 'Private',
      category: 'Unicast',
    })
  })

  it('classifies multicast range correctly', () => {
    const ip = parseIPv4('224.1.1.1')
    if (ip === null) throw new Error('Could not parse test IP')
    expect(classifyIPv4(ip).category).toBe('Multicast')
  })
})
