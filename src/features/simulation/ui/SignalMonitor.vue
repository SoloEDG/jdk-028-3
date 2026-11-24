<script setup lang="ts">
import { computed } from "vue";
import type { CircuitDocument, Signal, SimulationResult } from "@/shared/types";
import { resolveNetworks } from "@/features/circuit";
const props = defineProps<{
  document: CircuitDocument;
  signals: SimulationResult;
  selected: string | null;
}>();
const node = computed(() =>
  props.document.nodes.find((n) => n.id === props.selected),
);
const unknowns = computed(
  () =>
    Object.values(props.signals.values).filter((value) => value === "X").length,
);
const highZ = computed(() => {
  const count = Object.values(props.signals.networks).filter(
    (value) => value === "Z",
  ).length;
  return count;
});
const pinLabels = computed<string[]>(() => {
  if (!node.value) return [];
  if (node.value.kind === "TRI") return ["IN", "EN"];
  return (props.signals.pins[node.value.id] ?? []).map(
    (_, index) => `IN${index + 1}`,
  );
});
const selectedNetwork = computed(() => {
  if (!node.value) return null;
  const model = resolveNetworks(props.document);
  const entries = model.networks
    .map((network) => ({
      network,
      netId: network.id,
      level: props.signals.networks[network.id] ?? ("X" as Signal),
    }))
    .filter(({ network }) =>
      network.keys.some((key) => key.startsWith(`${node.value!.id}>`)),
    );
  return entries[0] ?? null;
});
const networkOwners = computed(() => {
  if (!selectedNetwork.value) return [];
  return selectedNetwork.value.network.keys.map((key) => {
    const [ownerId, suffix] = key.split(">");
    const ownerNode = props.document.nodes.find((n) => n.id === ownerId);
    const junction = props.document.junctions?.find((j) => j.id === ownerId);
    if (junction) return { label: "汇接点", suffix };
    return {
      label: ownerNode ? ownerNode.label : ownerId,
      suffix,
    };
  });
});
</script>
<template>
  <div class="signal-monitor">
    <div class="panel-heading"><span>信号观测</span><small>PROBE</small></div>
    <div v-if="node" class="probe-detail">
      <b>{{ node.label }}</b
      ><span
        v-for="(value, port) in signals.pins[node.id]"
        :key="port"
        >{{ pinLabels[port] ?? `IN${port + 1}` }}
        <strong :class="`text-${value}`">{{ value }}</strong></span
      ><span
        >OUT
        <strong :class="`text-${signals.values[node.id]}`">{{
          signals.values[node.id]
        }}</strong></span
      >
    </div>
    <div v-else class="probe-detail">
      <span>{{ document.nodes.length }} 个元件</span
      ><span>{{ document.junctions?.length ?? 0 }} 个汇接点</span
      ><span>{{ document.wires.length }} 条连线</span
      ><span>{{
        unknowns ? `${unknowns} 个未知信号` : "全部信号已确定"
      }}</span
      ><span :class="{ 'text-Z': highZ > 0 }">{{ highZ }} 个高阻网络</span>
    </div>
    <div v-if="node && selectedNetwork" class="network-ownership">
      <div class="ownership-title">
        所属网络 {{ selectedNetwork.netId }} · 电平
        <strong :class="`text-${selectedNetwork.level}`">{{
          selectedNetwork.level
        }}</strong>
      </div>
      <div class="ownership-list">
        <span v-for="owner in networkOwners" :key="owner.label + owner.suffix">
          {{ owner.label }}<small>{{ owner.suffix }}</small>
        </span>
      </div>
    </div>
    <div v-if="signals.conflicts.length" class="conflict-list">
      <p
        v-for="conflict in signals.conflicts"
        :key="conflict.networkId"
        class="conflict-item"
        role="alert"
      >
        ⚠ {{ conflict.message }}
      </p>
    </div>
    <p class="small-note">
      {{
        signals.conflicts.length
          ? "竞争随开关 / 使能实时变化：关闭冲突发送端后提示自动消失。"
          : unknowns
            ? "X 表示未知、竞争或使能未确定；Z 表示没有驱动的高阻。"
            : highZ
              ? "Z 是高阻，不是低电平；接入有效驱动后才会变为 0 或 1。"
              : "亮橙色线路表示 1，蓝灰色线路表示 0。"
      }}
    </p>
  </div>
</template>
