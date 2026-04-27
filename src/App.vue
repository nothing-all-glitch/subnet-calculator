<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BitValue } from './types/subnet'
import {
  bitsToInt,
  intToBits32,
  intToIPv4,
  networkOf,
  parseCidr,
  subnetDetailsFor,
} from './utils/ipMath'
import { allocateVlsm, parseHostRequirements } from './utils/subnetEngine'

const cidrInput = ref('192.168.5.0/24')
const hostRequirementsInput = ref('64, 45, 14, 9, 2')
const cidrError = ref('')

const bits = ref<BitValue[]>(intToBits32(0))
const prefix = ref(24)

function syncCidrFromState() {
  cidrInput.value = `${intToIPv4(currentIpInt.value)}/${prefix.value}`
}

function applyCidrInput() {
  const parsed = parseCidr(cidrInput.value)
  if (!parsed) {
    cidrError.value = 'Enter CIDR like 192.168.5.0/24'
    return
  }

  cidrError.value = ''
  const normalizedNetwork = networkOf(parsed.ip, parsed.prefix)
  bits.value = intToBits32(normalizedNetwork)
  prefix.value = parsed.prefix
  cidrInput.value = `${intToIPv4(normalizedNetwork)}/${parsed.prefix}`
}

function setPreset() {
  cidrInput.value = '192.168.5.0/24'
  hostRequirementsInput.value = '64, 45, 14, 9, 2'
  applyCidrInput()
}

const currentIpInt = computed(() => bitsToInt(bits.value))
const subnetDetails = computed(() => subnetDetailsFor(currentIpInt.value, prefix.value))
const prefixBoundaryStyle = computed(() => ({
  left: `${(prefix.value / 32) * 100}%`,
}))
const octets = computed(() => [
  (currentIpInt.value >>> 24) & 255,
  (currentIpInt.value >>> 16) & 255,
  (currentIpInt.value >>> 8) & 255,
  currentIpInt.value & 255,
])

const bitCells = computed(() =>
  bits.value.map((bit, index) => ({
    index,
    bit,
    octet: Math.floor(index / 8),
    weight: 2 ** (7 - (index % 8)),
    role: index < prefix.value ? 'network' : 'host',
  })),
)

const hostParse = computed(() => parseHostRequirements(hostRequirementsInput.value))
const vlsm = computed(() => {
  if (hostParse.value.error) {
    return { rows: [], error: hostParse.value.error }
  }

  return allocateVlsm(currentIpInt.value, prefix.value, hostParse.value.values, {
    prefer31PointToPoint: false,
  })
})

function toggleValue(index: number) {
  const next = [...bits.value]
  next[index] = next[index] === 1 ? 0 : 1
  bits.value = next
  syncCidrFromState()
}

function toggleRole(index: number) {
  prefix.value = index < prefix.value ? index : index + 1
  syncCidrFromState()
}

setPreset()
</script>

<template>
  <main class="layout">
    <header class="hero-card">
      <p class="eyebrow">Interactive Subnet Workbench</p>
      <h1>Visual IPv4 Subnet Calculator</h1>
      <p>
        Toggle bits, move the CIDR boundary, and watch subnet math update instantly with VLSM
        allocation.
      </p>
    </header>

    <section class="panel">
      <div class="controls">
        <label class="field">
          <span>Base network (CIDR)</span>
          <input
            v-model="cidrInput"
            type="text"
            placeholder="192.168.5.0/24"
            @input="applyCidrInput"
          />
        </label>

        <label class="field">
          <span>Required hosts (comma separated)</span>
          <input
            v-model="hostRequirementsInput"
            type="text"
            placeholder="64, 45, 14, 9, 2"
          />
        </label>

        <button class="preset-button" type="button" @click="setPreset">Load sample</button>
      </div>

      <p v-if="cidrError" class="error">{{ cidrError }}</p>
      <p v-if="hostParse.error" class="error">{{ hostParse.error }}</p>
      <p v-if="vlsm.error" class="error">{{ vlsm.error }}</p>
    </section>

    <section class="panel">
      <div class="bit-header">
        <h2>Interactive 32-bit Grid</h2>
        <span class="badge">/{{ prefix }}</span>
      </div>

      <div class="legend">
        <span class="swatch network">Network bit</span>
        <span class="swatch host">Host bit</span>
      </div>

      <div class="grid-wrap">
        <div class="octet-strip" aria-hidden="true">
          <span v-for="(octet, idx) in octets" :key="idx">Octet {{ idx + 1 }} • {{ octet }}</span>
        </div>
        <div class="boundary-line" :style="prefixBoundaryStyle" aria-hidden="true"></div>
        <div class="bit-grid" role="group" aria-label="Bit grid">
          <div
            v-for="cell in bitCells"
            :key="cell.index"
            class="bit-cell"
            :class="cell.role"
          >
            <button
              class="value-zone"
              type="button"
              :aria-label="`Toggle bit ${cell.index + 1} value`"
              @click="toggleValue(cell.index)"
            >
              {{ cell.bit }}
            </button>
            <button
              class="role-zone"
              type="button"
              :aria-label="`Toggle bit ${cell.index + 1} role`"
              @click="toggleRole(cell.index)"
            >
              {{ cell.role === 'network' ? 'N' : 'H' }}
            </button>
            <span class="weight">{{ cell.weight }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="panel stats">
      <article>
        <h3>Current IP</h3>
        <p>{{ intToIPv4(subnetDetails.ip) }}/{{ subnetDetails.prefix }}</p>
      </article>
      <article>
        <h3>Subnet Mask</h3>
        <p>{{ intToIPv4(subnetDetails.mask) }}</p>
      </article>
      <article>
        <h3>Network</h3>
        <p>{{ intToIPv4(subnetDetails.network) }}</p>
      </article>
      <article>
        <h3>Broadcast</h3>
        <p>{{ intToIPv4(subnetDetails.broadcast) }}</p>
      </article>
      <article>
        <h3>Usable Range</h3>
        <p>{{ intToIPv4(subnetDetails.firstUsable) }} - {{ intToIPv4(subnetDetails.lastUsable) }}</p>
      </article>
      <article>
        <h3>Usable Hosts</h3>
        <p>{{ subnetDetails.usableHostCount }}</p>
      </article>
    </section>

    <section class="panel">
      <h2>VLSM Allocation</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Requested Hosts</th>
              <th>Subnet</th>
              <th>Network</th>
              <th>First Host</th>
              <th>Last Host</th>
              <th>Broadcast</th>
              <th>Usable</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in vlsm.rows" :key="`${row.network}-${index}`">
              <td>{{ row.requestedHosts }}</td>
              <td>/{{ row.prefix }}</td>
              <td>{{ intToIPv4(row.network) }}</td>
              <td>{{ intToIPv4(row.firstUsable) }}</td>
              <td>{{ intToIPv4(row.lastUsable) }}</td>
              <td>{{ intToIPv4(row.broadcast) }}</td>
              <td>{{ row.usableHostCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </main>
</template>
