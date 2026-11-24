<script setup lang="ts">
import type { CircuitDocument, SimulationResult } from "@/shared/types";
import { endpointPoint, wirePath } from "../lib/geometry";
const props = defineProps<{
  document: CircuitDocument;
  signals: SimulationResult;
  selected: string | null;
}>();
defineEmits<{ select: [id: string] }>();
function pathFor(id: string) {
  const wire = props.document.wires.find((w) => w.id === id)!;
  const from = endpointPoint(props.document, wire.from, "from");
  const to = endpointPoint(props.document, wire.to, "to");
  return from && to ? wirePath(from, to) : "";
}
function conflicted(wireId: string): boolean {
  return props.signals.conflicts.some((conflict) =>
    conflict.wireIds.includes(wireId),
  );
}
</script>
<template>
  <g class="wires"
    ><g v-for="wire in document.wires" :key="wire.id"
      ><path
        :d="pathFor(wire.id)"
        class="wire-hit"
        role="button"
        tabindex="0"
        :aria-label="`选择连线，当前电平 ${signals.wires[wire.id] ?? 'X'}`"
        @pointerdown.stop
        @click.stop="$emit('select', wire.id)"
        @keydown.enter="$emit('select', wire.id)" /><path
        :d="pathFor(wire.id)"
        :class="[
          'wire',
          `wire-${signals.wires[wire.id] ?? 'X'}`,
          {
            'wire-selected': selected === wire.id,
            'wire-conflict': conflicted(wire.id),
          },
        ]" /></g
  ></g>
</template>
