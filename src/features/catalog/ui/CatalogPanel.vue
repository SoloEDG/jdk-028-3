<script setup lang="ts">
import type { PlacementKind } from "@/shared/types";
import { gateSpecs } from "../lib/specs";
import GateTile from "./GateTile.vue";
defineProps<{ tool: PlacementKind | null }>();
defineEmits<{ choose: [kind: PlacementKind | null] }>();
</script>
<template>
  <aside class="catalog panel">
    <div class="panel-heading">
      <span>元件库</span><small>COMPONENTS</small>
    </div>
    <p class="panel-help">选择元件，再点击工作台放置。</p>
    <div class="gate-list">
      <GateTile
        v-for="spec in gateSpecs"
        :key="spec.kind"
        :spec="spec"
        :active="tool === spec.kind"
        @choose="$emit('choose', tool === spec.kind ? null : spec.kind)"
      />
      <button
        class="gate-tile junction-tile"
        :class="{ active: tool === 'JUNCTION' }"
        title="汇接点：只有明确的汇接点才合并网络；线路交叉不电气相连"
        :aria-pressed="tool === 'JUNCTION'"
        @click="$emit('choose', tool === 'JUNCTION' ? null : 'JUNCTION')"
      >
        <span class="gate-symbol junction-symbol">●</span
        ><span
          ><strong>汇接点</strong><small>JUNCTION</small></span
        ><span class="tile-plus">＋</span>
      </button>
    </div>
    <div class="legend">
      <span><i class="dot high" />高电平 1</span
      ><span><i class="dot low" />低电平 0</span
      ><span><i class="dot unknown" />未知 / 竞争 X</span
      ><span><i class="dot hiz" />高阻 Z</span>
    </div>
    <p class="small-note">
      先点输出端口，再点输入端口。<br />一个输出可以连接多个输入；多个发送端经
      BUS 或汇接点共享同一根线。<br />高阻 Z 不是低电平，竞争会标红冲突发送端。
    </p>
  </aside>
</template>
