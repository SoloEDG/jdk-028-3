import type {
  CircuitDocument,
  ConflictInfo,
  GateNode,
  Signal,
} from "@/shared/types";
import {
  networkDrivers,
  pinKey,
  type NetworkModel,
} from "@/features/circuit";

/**
 * 四态总线合并格：
 * - 没有任何有效驱动 -> Z（高阻，不是低电平）
 * - 单个确定驱动 0/1 -> 该电平
 * - 两个有效驱动给出相反电平 -> X（竞争）
 * - 含使能未知的三态驱动（贡献 X）时，结果至少为 X
 * Z 与任何确定电平合并取该电平；X 与任何值合并仍为 X。
 */
export function mergeSignals(signals: Signal[]): Signal {
  let result: Signal = "Z";
  for (const signal of signals) {
    if (signal === "Z") continue;
    if (result === "Z") result = signal;
    else if (result === "X" || signal === "X") result = "X";
    else if (result !== signal) result = "X";
  }
  return result;
}

export interface DriverContribution {
  node: GateNode;
  /** 该驱动此刻在网络上贡献的电平（TRI 断开时为 Z） */
  level: Signal;
  /** 使能确定为有效（TRI 的 EN=1，或普通推挽输出） */
  definitelyOn: boolean;
  /** 使能未知的三态驱动，可能接通也可能断开 */
  enableUnknown: boolean;
}

export function collectDrivers(
  document: CircuitDocument,
  model: NetworkModel,
  networkId: string,
  nodeValues: Record<string, Signal>,
  triEnable: Record<string, Signal>,
): DriverContribution[] {
  const result: DriverContribution[] = [];
  for (const endpoint of networkDrivers(document, model, networkId)) {
    const node = document.nodes.find((item) => item.id === endpoint.nodeId);
    if (!node) continue;
    const raw = nodeValues[node.id] ?? "X";
    if (node.kind === "TRI") {
      const enable = triEnable[node.id] ?? "X";
      if (enable === 0)
        result.push({ node, level: "Z", definitelyOn: false, enableUnknown: false });
      else if (enable === 1)
        result.push({ node, level: raw, definitelyOn: true, enableUnknown: false });
      else
        result.push({ node, level: "X", definitelyOn: false, enableUnknown: true });
    } else {
      result.push({ node, level: raw, definitelyOn: true, enableUnknown: false });
    }
  }
  return result;
}

export function detectConflict(
  model: NetworkModel,
  networkId: string,
  contributions: DriverContribution[],
  level: Signal,
): ConflictInfo | null {
  const network = model.networks.find((item) => item.id === networkId)!;
  // 只有“确定接通且电平相反”的发送端才构成真正竞争
  const active = contributions.filter(
    (item) => item.definitelyOn && (item.level === 0 || item.level === 1),
  );
  const lows = active.filter((item) => item.level === 0);
  const highs = active.filter((item) => item.level === 1);
  if (lows.length && highs.length) {
    const drivers = [...lows, ...highs].map((item) => item.node);
    return {
      networkId,
      message: conflictMessage(drivers),
      driverIds: drivers.map((node) => node.id),
      wireIds: [...network.wires],
      points: network.points,
    };
  }
  // 使能未知：该发送端可能接通也可能断开，总线无法确定（即使只有一路也提示）
  const unknowns = contributions.filter((item) => item.enableUnknown);
  if (level === "X" && unknowns.length) {
    const drivers = unknowns.map((item) => item.node);
    return {
      networkId,
      message: unknownMessage(drivers),
      driverIds: drivers.map((node) => node.id),
      wireIds: [...network.wires],
      points: network.points,
    };
  }
  return null;
}

function conflictMessage(drivers: GateNode[]): string {
  return `总线竞争：发送端 ${drivers
    .map((node) => node.label)
    .join("、")} 同时有效且电平相反，请关闭其中一路三态使能`;
}
function unknownMessage(drivers: GateNode[]): string {
  return `使能未知：发送端 ${drivers
    .map((node) => node.label)
    .join("、")} 可能接通也可能断开，总线电平无法确定（X）`;
}

/** 接收端引脚电平：悬空为 X；挂上高阻网络为 Z（绝不折算成 0） */
export function networkLevelAt(
  model: NetworkModel,
  levels: Map<string, Signal>,
  nodeId: string,
  direction: "in" | "out",
  port: number,
): Signal {
  const netId = model.netOfKey.get(pinKey(nodeId, direction, port));
  if (!netId) return "X";
  return levels.get(netId) ?? "X";
}
