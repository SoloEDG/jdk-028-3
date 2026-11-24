import type { CircuitDocument, GateKind } from "@/shared/types";
import { getSpec } from "@/features/catalog";
import {
  networkDrivers,
  pinKey,
  resolveNetworks,
} from "./networks";

/**
 * 计算无环组合电路的求值顺序。
 * 依赖关系以“输入引脚所在网络的真正驱动元件”为准，
 * 因此连线经过汇接点或 BUS 短接时，依赖仍能正确传递；
 * 汇接点与 BUS 本身不是求值节点。
 */
export function topologicalOrder(document: CircuitDocument): string[] {
  const model = resolveNetworks(document);
  const ids = new Set(document.nodes.map((node) => node.id));
  const degrees = new Map<string, number>(
    document.nodes.map((node) => [node.id, 0]),
  );
  const next = new Map<string, string[]>(
    document.nodes.map((node) => [node.id, []]),
  );
  const addEdge = (fromId: string, toId: string) => {
    if (!ids.has(fromId) || !ids.has(toId))
      throw new Error("连线引用了不存在的元件");
    degrees.set(toId, degrees.get(toId)! + 1);
    next.get(fromId)!.push(toId);
  };
  for (const node of document.nodes) {
    if (node.kind === "BUS" || node.kind === "INPUT") continue;
    const inputCount = getSpec(node.kind).inputs;
    for (let port = 0; port < inputCount; port++) {
      const netId = model.netOfKey.get(pinKey(node.id, "in", port));
      if (!netId) continue; // 悬空输入不产生依赖
      const drivers = networkDrivers(document, model, netId);
      for (const driver of drivers)
        if (driver.nodeId !== node.id) addEdge(driver.nodeId, node.id);
    }
  }
  const queue = [...degrees]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  for (let i = 0; i < queue.length; i++)
    for (const id of next.get(queue[i])!) {
      degrees.set(id, degrees.get(id)! - 1);
      if (degrees.get(id) === 0) queue.push(id);
    }
  if (queue.length !== document.nodes.length)
    throw new Error("当前实验只支持无环组合电路，请断开反馈连线");
  return queue;
}

export function kindInputs(kind: GateKind): number {
  return getSpec(kind).inputs;
}
