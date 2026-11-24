<script setup lang="ts">
import { computed } from "vue";
import type { CircuitDocument, Signal, SimulationResult } from "@/shared/types";
import { pinKey, resolveNetworks } from "../lib/networks";
const props = defineProps<{
  document: CircuitDocument;
  signals: SimulationResult;
  selected: string | null;
}>();
const emit = defineEmits<{
  select: [id: string];
  port: [id: string];
  startDrag: [event: PointerEvent, id: string];
}>();
const junctions = computed(() => props.document.junctions ?? []);
const junctionLevel = computed(() => {
  const model = resolveNetworks(props.document);
  const map = new Map<string, Signal>();
  for (const junction of props.document.junctions ?? []) {
    const netId = model.netOfKey.get(pinKey(junction.id, "junction"));
    map.set(
      junction.id,
      netId ? (props.signals.networks[netId] ?? "X") : "X",
    );
  }
  return map;
});
const conflictIds = computed(() => {
  const ids = new Set<string>();
  for (const conflict of props.signals.conflicts)
    for (const point of conflict.points)
      for (const junction of props.document.junctions ?? [])
        if (junction.x === point.x && junction.y === point.y)
          ids.add(junction.id);
  return ids;
});
</script>
<template>
  <g class="junctions">
    <g
      v-for="junction in junctions"
      :key="junction.id"
      :class="[
        'junction',
        `junction-${junctionLevel.get(junction.id) ?? 'X'}`,
        {
          'junction-selected': selected === junction.id,
          'junction-conflict': conflictIds.has(junction.id),
        },
      ]"
      role="button"
      tabindex="0"
      :aria-label="`汇接点，电平 ${junctionLevel.get(junction.id) ?? 'X'}`"
      @pointerdown.stop="emit('startDrag', $event, junction.id)"
      @click.stop="emit('port', junction.id)"
      @keydown.enter="emit('port', junction.id)"
    >
      <circle :cx="junction.x" :cy="junction.y" r="12" class="junction-hit" />
      <circle :cx="junction.x" :cy="junction.y" r="6" class="junction-dot" />
      <template v-if="conflictIds.has(junction.id)">
        <circle
          :cx="junction.x + 9"
          :cy="junction.y - 9"
          r="7"
          class="conflict-badge"
        />
        <text
          :x="junction.x + 9"
          :y="junction.y - 5"
          class="conflict-badge-text"
          pointer-events="none"
          >!</text
        >
      </template>
    </g>
  </g>
</template>
