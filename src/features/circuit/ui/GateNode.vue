<script setup lang="ts">
import { computed } from "vue";
import type { GateNode, Signal } from "@/shared/types";
import type { PortRequest } from "@/shared/commands";
import { getSpec } from "@/features/catalog";
import { BOARD, portPoint } from "../lib/geometry";
const props = defineProps<{
  node: GateNode;
  value: Signal;
  selected: boolean;
  pending: boolean;
}>();
const emit = defineEmits<{
  select: [id: string];
  startDrag: [event: PointerEvent, id: string];
  port: [port: PortRequest];
  toggle: [id: string];
}>();
const spec = computed(() => getSpec(props.node.kind));
const inputNames = computed<string[]>(() => {
  return Array.from({ length: spec.value.inputs }, (_, index) =>
    index === 0 && props.node.kind === "TRI"
      ? "IN"
      : index === 1 && props.node.kind === "TRI"
        ? "EN"
        : `IN${index + 1}`,
  );
});
</script>
<template>
  <g
    class="gate-node"
    :class="[`kind-${node.kind}`, { 'is-selected': selected }]"
    :data-node="node.id"
    role="group"
    tabindex="0"
    :aria-label="node.label"
    @keydown.enter.self="emit('select', node.id)"
    ><rect
      :x="node.x"
      :y="node.y"
      :width="BOARD.nodeWidth"
      :height="BOARD.nodeHeight"
      rx="10"
      class="node-body"
      @pointerdown.stop="emit('startDrag', $event, node.id)" /><text
      :x="node.x + 12"
      :y="node.y + 21"
      class="node-label"
      pointer-events="none"
      >{{ node.label }}</text
    ><text
      :x="node.x + 56"
      :y="node.y + 57"
      class="node-symbol"
      pointer-events="none"
      >{{ spec.symbol }}</text
    >
    <!-- TRI 使能标记 -->
    <text
      v-if="node.kind === 'TRI'"
      :x="node.x + 6"
      :y="node.y + 75"
      class="pin-tag"
      pointer-events="none"
      >EN</text
    ><text
      v-if="node.kind === 'TRI'"
      :x="node.x + 6"
      :y="node.y + 46"
      class="pin-tag"
      pointer-events="none"
      >IN</text
    >
    <!-- 输入开关 -->
    <g
      v-if="node.kind === 'INPUT'"
      role="button"
      tabindex="0"
      :aria-label="`切换 ${node.label}，当前 ${value}`"
      @pointerdown.stop
      @click.stop="emit('toggle', node.id)"
      @keydown.enter.prevent="emit('toggle', node.id)"
      @keydown.space.prevent="emit('toggle', node.id)"
      ><rect
        :x="node.x + 74"
        :y="node.y + 42"
        width="27"
        height="28"
        rx="6"
        :class="`switch signal-${value}`"
      /><text :x="node.x + 87" :y="node.y + 61" class="switch-text">{{
        value
      }}</text></g
    >
    <!-- 输出指示灯与探针：如实显示 Z，不把高阻当 0 -->
    <g v-if="node.kind === 'OUTPUT' || node.kind === 'PROBE'"
      ><circle
        :cx="node.x + 88"
        :cy="node.y + 52"
        r="11"
        :class="`output-led signal-${value}`"
      /><text :x="node.x + 88" :y="node.y + 57" class="led-text">{{
        value === "Z" ? "Z" : value
      }}</text></g
    >
    <!-- BUS 共享总线标识 -->
    <g v-if="node.kind === 'BUS'" class="bus-mark"
      ><line
        :x1="node.x + 18"
        :y1="node.y + BOARD.nodeHeight / 2"
        :x2="node.x + BOARD.nodeWidth - 18"
        :y2="node.y + BOARD.nodeHeight / 2"
        :class="`bus-rail signal-${value}`"
      /><text :x="node.x + 56" :y="node.y + 38" class="pin-tag" pointer-events="none"
        >{{ value === "Z" ? "高阻 Z" : `电平 ${value}` }}</text
      ></g
    >
    <circle
      v-for="port in spec.inputs"
      :key="`in${port}`"
      :cx="portPoint(node, 'input', port - 1).x"
      :cy="portPoint(node, 'input', port - 1).y"
      r="7"
      :class="[
        'port input-port',
        { 'bus-fanin-port': node.kind === 'BUS' },
      ]"
      role="button"
      tabindex="0"
      :aria-label="`${node.label} ${inputNames[port - 1] ?? `输入 ${port}`}`"
      @pointerdown.stop
      @click.stop="
        emit('port', { nodeId: node.id, port: port - 1, direction: 'input' })
      "
      @keydown.enter="
        emit('port', { nodeId: node.id, port: port - 1, direction: 'input' })
      " /><circle
      v-if="spec.outputs"
      :cx="portPoint(node, 'output').x"
      :cy="portPoint(node, 'output').y"
      r="7"
      :class="['port', `signal-${value}`, { 'port-pending': pending }]"
      role="button"
      tabindex="0"
      :aria-label="`${node.label} 输出端口`"
      @pointerdown.stop
      @click.stop="
        emit('port', { nodeId: node.id, port: 0, direction: 'output' })
      "
      @keydown.enter="
        emit('port', { nodeId: node.id, port: 0, direction: 'output' })
      "
  /></g>
</template>
