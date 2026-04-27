<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BitValue } from './types/subnet'
import {
  bitsToInt,
  classifyIPv4,
  intToBits32,
  intToIPv4,
  networkOf,
  parseCidr,
  subnetDetailsFor,
  wildcardMaskFromPrefix,
} from './utils/ipMath'

type CalcMode = 'subnet' | 'bitlab'

interface PresetConfig {
  label: string
  cidr: string
}

interface HistoryEntry {
  cidr: string
  timestamp: number
}

const cidrInput = ref('192.168.5.0/24')
const cidrError = ref('')
const activeMode = ref<CalcMode>('subnet')
const copyStatus = ref('')
const selectedPreset = ref('Sample (192.168.5.0/24)')
const historyEntries = ref<HistoryEntry[]>([])
const showNextSubnets = ref(true)
const subnetPreviewCount = ref(5)

const bits = ref<BitValue[]>(intToBits32(0))
const prefix = ref(24)

const HISTORY_KEY = 'subnet-calculator-history-v2'
const quickPresets: PresetConfig[] = [
  { label: 'Sample (192.168.5.0/24)', cidr: '192.168.5.0/24' },
  { label: 'Lab A (10.10.0.0/20)', cidr: '10.10.0.0/20' },
  { label: 'Lab B (172.16.20.0/23)', cidr: '172.16.20.0/23' },
  { label: 'Branch WAN (192.168.13.0/21)', cidr: '192.168.13.0/21' },
]

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyEntries.value.slice(0, 8)))
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as HistoryEntry[]
    if (Array.isArray(parsed)) {
      historyEntries.value = parsed.filter((entry) => entry?.cidr)
    }
  } catch {
    historyEntries.value = []
  }
}

function pushHistoryEntry() {
  const normalized = cidrInput.value.trim()
  if (!normalized || cidrError.value) return

  const next: HistoryEntry = {
    cidr: normalized,
    timestamp: Date.now(),
  }
  historyEntries.value = [next, ...historyEntries.value.filter((entry) => entry.cidr !== next.cidr)].slice(
    0,
    8,
  )
  saveHistory()
}

function syncCidrFromState() {
  cidrInput.value = `${intToIPv4(currentIpInt.value)}/${prefix.value}`
}

function applyCidrInput() {
  const raw = cidrInput.value.trim()
  if (!raw.includes('/')) {
    cidrError.value = 'CIDR must include prefix, for example: 192.168.5.0/24'
    return
  }

  const parsed = parseCidr(raw)
  if (!parsed) {
    cidrError.value = 'Invalid CIDR. Use IPv4 format like 192.168.5.0/24'
    return
  }

  cidrError.value = ''
  const normalizedNetwork = networkOf(parsed.ip, parsed.prefix)
  bits.value = intToBits32(normalizedNetwork)
  prefix.value = parsed.prefix
  cidrInput.value = `${intToIPv4(normalizedNetwork)}/${parsed.prefix}`
  pushHistoryEntry()
}

function setPreset() {
  cidrInput.value = '192.168.5.0/24'
  applyCidrInput()
}

function applySelectedPreset() {
  const preset = quickPresets.find((item) => item.label === selectedPreset.value)
  if (!preset) return
  cidrInput.value = preset.cidr
  applyCidrInput()
}

function applyHistoryEntry(entry: HistoryEntry) {
  cidrInput.value = entry.cidr
  applyCidrInput()
}

const currentIpInt = computed(() => bitsToInt(bits.value))
const subnetDetails = computed(() => subnetDetailsFor(currentIpInt.value, prefix.value))
const classification = computed(() => classifyIPv4(currentIpInt.value))
const wildcardMask = computed(() => wildcardMaskFromPrefix(prefix.value))
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
    weight: 2 ** (7 - (index % 8)),
    role: index < prefix.value ? 'network' : 'host',
  })),
)

const subnetSequence = computed(() => {
  if (!showNextSubnets.value) return []
  const count = Math.min(32, Math.max(1, Math.floor(subnetPreviewCount.value)))
  const blockSize = 2 ** (32 - prefix.value)
  const start = networkOf(currentIpInt.value, prefix.value)
  const rows: Array<{ index: number; network: number; firstUsable: number; lastUsable: number; broadcast: number }> = []

  for (let index = 0; index < count; index += 1) {
    const candidate = start + index * blockSize
    if (candidate > 0xffffffff) break
    const details = subnetDetailsFor(candidate >>> 0, prefix.value)
    rows.push({
      index,
      network: details.network,
      firstUsable: details.firstUsable,
      lastUsable: details.lastUsable,
      broadcast: details.broadcast,
    })
  }
  return rows
})

async function copyText(label: string, content: string) {
  await navigator.clipboard.writeText(content)
  copyStatus.value = `${label} copied`
  setTimeout(() => {
    copyStatus.value = ''
  }, 1600)
}

async function copySubnetSummary() {
  const summary = [
    `CIDR: ${intToIPv4(subnetDetails.value.network)}/${subnetDetails.value.prefix}`,
    `Mask: ${intToIPv4(subnetDetails.value.mask)}`,
    `Wildcard: ${intToIPv4(wildcardMask.value)}`,
    `Broadcast: ${intToIPv4(subnetDetails.value.broadcast)}`,
    `Range: ${intToIPv4(subnetDetails.value.firstUsable)} - ${intToIPv4(subnetDetails.value.lastUsable)}`,
  ].join('\n')
  await copyText('Subnet summary', summary)
}

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

loadHistory()
setPreset()
</script>

<template>
  <main class="layout">
    <header class="hero-card">
      <p class="eyebrow">Interactive Subnet Workbench</p>
      <h1>Visual IPv4 Subnet Calculator</h1>
      <p>Toggle bits, move the CIDR boundary, and optionally preview the next subnets in sequence.</p>
    </header>

    <section class="panel mode-tabs">
      <button type="button" :class="{ active: activeMode === 'subnet' }" @click="activeMode = 'subnet'">
        Subnet Details
      </button>
      <button type="button" :class="{ active: activeMode === 'bitlab' }" @click="activeMode = 'bitlab'">
        Bit Lab
      </button>
    </section>

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
          <small>Input is auto-normalized to its actual network address.</small>
        </label>

        <button class="preset-button" type="button" @click="setPreset">Load sample</button>
      </div>

      <div class="controls tools-row">
        <label class="field">
          <span>Quick preset</span>
          <select v-model="selectedPreset">
            <option v-for="preset in quickPresets" :key="preset.label" :value="preset.label">
              {{ preset.label }}
            </option>
          </select>
        </label>
        <button class="preset-button" type="button" @click="applySelectedPreset">Apply preset</button>
        <button class="preset-button secondary" type="button" @click="copySubnetSummary">Copy subnet summary</button>
      </div>

      <div v-if="historyEntries.length > 0" class="history-list">
        <span>Recent:</span>
        <button
          v-for="entry in historyEntries"
          :key="`${entry.cidr}-${entry.timestamp}`"
          type="button"
          @click="applyHistoryEntry(entry)"
        >
          {{ entry.cidr }}
        </button>
      </div>

      <p v-if="cidrError" class="error">{{ cidrError }}</p>
      <p v-if="copyStatus" class="copy-status">{{ copyStatus }}</p>
    </section>

    <section v-if="activeMode === 'bitlab'" class="panel">
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
        <h3>Wildcard Mask</h3>
        <p>{{ intToIPv4(wildcardMask) }}</p>
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
      <article>
        <h3>Class / Scope</h3>
        <p>Class {{ classification.addressClass }} • {{ classification.scope }}</p>
      </article>
      <article>
        <h3>Category</h3>
        <p>{{ classification.category }}</p>
      </article>
    </section>

    <section class="panel">
      <div class="bit-header">
        <h2>Subnet Sequence</h2>
      </div>
      <label class="toggle-row">
        <input v-model="showNextSubnets" type="checkbox" />
        <span>Show next subnets</span>
      </label>
      <div v-if="showNextSubnets" class="controls tools-row">
        <label class="field">
          <span>How many subnets to preview</span>
          <input v-model.number="subnetPreviewCount" type="number" min="1" max="32" />
        </label>
      </div>
      <div v-if="showNextSubnets" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Subnet</th>
              <th>Network</th>
              <th>First Host</th>
              <th>Last Host</th>
              <th>Broadcast</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in subnetSequence" :key="row.index">
              <td>{{ row.index + 1 }}</td>
              <td>/{{ prefix }}</td>
              <td>{{ intToIPv4(row.network) }}</td>
              <td>{{ intToIPv4(row.firstUsable) }}</td>
              <td>{{ intToIPv4(row.lastUsable) }}</td>
              <td>{{ intToIPv4(row.broadcast) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
