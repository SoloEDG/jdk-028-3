import type {
  CircuitDocument,
  ConflictInfo,
  Signal,
  SimulationResult,
} from "@/shared/types";
import { getSpec } from "@/features/catalog";
import {
  pinKey,
  resolveNetworks,
  topologicalOrder,
} from "@/features/circuit";
import { gateValue, triState } from "./logic";
import {
  collectDrivers,
  detectConflict,
  mergeSignals,
  networkLevelAt,
} from "./bus";

export function evaluate(
  document: CircuitDocument,
  overrides: Record<string, 0 | 1> = {},
): SimulationResult {
  const model = resolveNetworks(document);
  const order = topologicalOrder(document);
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));

  // 每个输入引脚在求值时刻看到的网络电平（含 Z；悬空为 X）
  const pins: Record<string, Signal[]> = Object.create(null);
  // 节点自身的输出值（TRI 在此保留“缓冲值”，是否高阻由使能另行决定）
  const values: Record<string, Signal> = Object.create(null);
  // TRI 使能脚的电平，供总线阶段判断接通/高阻/未知
  const triEnable: Record<string, Signal> = Object.create(null);
  // 每个网络在节点求值过程中最新解析出的电平
  const levels = new Map<string, Signal>();

  const pinLevel = (nodeId: string, port: number): Signal => {
    const netId = model.netOfKey.get(pinKey(nodeId, "in", port));
    if (!netId) return "X"; // 悬空输入
    return levels.get(netId) ?? "Z";
  };

  for (const id of order) {
    const node = nodes.get(id)!;
    const spec = getSpec(node.kind);
    const inputSignals = Array.from({ length: spec.inputs }, (_, port) =>
      pinLevel(id, port),
    );
    pins[id] = inputSignals;

    if (node.kind === "INPUT") {
      values[id] = Object.hasOwn(overrides, id) ? overrides[id] : node.value;
    } else if (node.kind === "TRI") {
      const [data, enable] = inputSignals;
      triEnable[id] = enable;
      // 节点值记录“假设接通”的缓冲值；高阻在总线阶段按使能再决定
      values[id] = triState(data, enable === 0 ? 0 : enable === 1 ? 1 : "X");
    } else if (node.kind === "BUS") {
      // BUS 是无源短接点：其电平即输入侧网络的解析结果，不产生驱动
      values[id] = pinLevel(id, 0);
    } else {
      values[id] = gateValue(node.kind, inputSignals);
    }

    // 该节点若驱动某个网络，立即刷新该网络电平，供下游在本拍读取
    if (spec.outputs > 0 && node.kind !== "BUS")
      refreshNetwork(document, model, id, levels, values, triEnable);
    if (node.kind === "BUS")
      levels.set(
        model.netOfKey.get(pinKey(id, "in", 0))!,
        values[id],
      );
  }

  // 汇总阶段：重新解析全部网络，得到稳定电平与竞争信息
  const conflicts: ConflictInfo[] = [];
  const networks: Record<string, Signal> = Object.create(null);
  for (const network of model.networks) {
    const contributions = collectDrivers(
      document,
      model,
      network.id,
      values,
      triEnable,
    );
    const level = mergeSignals(contributions.map((item) => item.level));
    levels.set(network.id, level);
    networks[network.id] = level;
    const conflict = detectConflict(model, network.id, contributions, level);
    if (conflict) conflicts.push(conflict);
  }

  // 用最终网络电平回填接收端引脚（确保 PROBE / OUTPUT 显示真实 Z）
  for (const node of document.nodes) {
    const spec = getSpec(node.kind);
    if (!spec.inputs) continue;
    pins[node.id] = Array.from({ length: spec.inputs }, (_, port) =>
      networkLevelAt(model, levels, node.id, "in", port),
    );
    if (node.kind === "OUTPUT" || node.kind === "PROBE")
      values[node.id] = pins[node.id][0];
    if (node.kind === "BUS") values[node.id] = pins[node.id][0];
  }

  const wireNetwork: Record<string, string> = Object.create(null);
  const wires: Record<string, Signal> = Object.create(null);
  for (const wire of document.wires) {
    const netId = model.wireNetwork.get(wire.id)!;
    wireNetwork[wire.id] = netId;
    wires[wire.id] = levels.get(netId) ?? "Z";
  }

  return { values, pins, wires, order, networks, wireNetwork, conflicts };
}

function refreshNetwork(
  document: CircuitDocument,
  model: ReturnType<typeof resolveNetworks>,
  nodeId: string,
  levels: Map<string, Signal>,
  values: Record<string, Signal>,
  triEnable: Record<string, Signal>,
): void {
  const netId = model.netOfKey.get(pinKey(nodeId, "out", 0));
  if (!netId) return;
  const contributions = collectDrivers(
    document,
    model,
    netId,
    values,
    triEnable,
  );
  levels.set(
    netId,
    mergeSignals(contributions.map((item) => item.level)),
  );
}
