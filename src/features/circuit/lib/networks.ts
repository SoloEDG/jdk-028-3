import type {
  CircuitDocument,
  Endpoint,
  GateNode,
  Junction,
  Point,
} from "@/shared/types";
import { getSpec } from "@/features/catalog";
import { BOARD, portPoint } from "./geometry";

export type PinDirection = "in" | "out" | "junction";
export interface PinKey {
  ownerId: string;
  direction: PinDirection;
  port: number;
}
export interface EndpointOwner {
  kind: "node" | "junction";
  node?: GateNode;
  junction?: Junction;
}
export interface ResolvedNetwork {
  id: string;
  keys: string[];
  wires: string[];
  points: Point[];
}
export interface NetworkModel {
  /** 端点键 -> 网络编号 */
  netOfKey: Map<string, string>;
  /** 网络编号 -> 成员端点键 */
  members: Map<string, string[]>;
  /** 线段编号 -> 网络编号 */
  wireNetwork: Map<string, string>;
  networks: ResolvedNetwork[];
}

export function pinKey(
  ownerId: string,
  direction: PinDirection,
  port = 0,
): string {
  return direction === "junction"
    ? `${ownerId}>j`
    : `${ownerId}>${direction}${port}`;
}
export function parsePinKey(key: string): PinKey {
  const index = key.lastIndexOf(">");
  const ownerId = key.slice(0, index),
    suffix = key.slice(index + 1);
  if (suffix === "j") return { ownerId, direction: "junction", port: 0 };
  return {
    ownerId,
    direction: suffix.startsWith("in") ? "in" : "out",
    port: Number(suffix.slice(2)),
  };
}
export function endpointOwner(
  document: CircuitDocument,
  endpoint: Endpoint,
): EndpointOwner {
  const junction = document.junctions?.find(
    (item) => item.id === endpoint.nodeId,
  );
  if (junction) return { kind: "junction", junction };
  const node = document.nodes.find((item) => item.id === endpoint.nodeId);
  return node ? { kind: "node", node } : { kind: "junction" };
}
/**
 * 把通用端点（含汇接点）翻译成带方向的唯一引脚键。
 * 方向由连线端点角色显式给出：零输入元件（如 INPUT）的输出不能误判成 in0。
 */
export function keyOfEndpoint(
  document: CircuitDocument,
  endpoint: Endpoint,
  role: "from" | "to",
): string {
  const owner = endpointOwner(document, endpoint);
  if (owner.kind === "junction") return pinKey(endpoint.nodeId, "junction");
  const node = owner.node!;
  // from 端是驱动输出，to 端是接收输入；BUS 输入侧按 to 处理
  const direction: PinDirection = role === "from" ? "out" : "in";
  return pinKey(node.id, direction, endpoint.port);
}
export function isOutputEndpoint(
  document: CircuitDocument,
  endpoint: Endpoint,
): boolean {
  const owner = endpointOwner(document, endpoint);
  return (
    owner.kind === "node" &&
    !!owner.node &&
    endpoint.port < getSpec(owner.node.kind).outputs
  );
}
export function isInputEndpoint(
  document: CircuitDocument,
  endpoint: Endpoint,
): boolean {
  const owner = endpointOwner(document, endpoint);
  return (
    owner.kind === "node" &&
    !!owner.node &&
    endpoint.port < getSpec(owner.node.kind).inputs
  );
}

class UnionFind {
  private parent = new Map<string, string>();
  ensure(key: string): string {
    if (!this.parent.has(key)) this.parent.set(key, key);
    let root = this.parent.get(key)!;
    if (root === key) return root;
    const path: string[] = [];
    let current = key;
    while (this.parent.get(current) !== current) {
      path.push(current);
      current = this.parent.get(current)!;
    }
    root = current;
    for (const item of path) this.parent.set(item, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.ensure(a),
      rb = this.ensure(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
  keys(): string[] {
    return [...this.parent.keys()];
  }
}

/**
 * 依据显式连线、汇接点与 BUS 内部短接划分电气网络。
 * 线路交叉不在数据里产生任何连接；只有同一汇接点或 BUS 短接才合并网络。
 * 网络编号按线段首次出现顺序分配，保存重开后保持稳定。
 */
export function resolveNetworks(document: CircuitDocument): NetworkModel {
  const uf = new UnionFind();
  for (const wire of document.wires) {
    const from = keyOfEndpoint(document, wire.from, "from"),
      to = keyOfEndpoint(document, wire.to, "to");
    uf.union(from, to);
  }
  // BUS 元件的输入端口与输出端口在内部短接为同一根总线
  for (const node of document.nodes)
    if (node.kind === "BUS")
      uf.union(pinKey(node.id, "in", 0), pinKey(node.id, "out", 0));

  const rootToId = new Map<string, string>();
  const members = new Map<string, string[]>();
  const netOfKey = new Map<string, string>();
  const idOfRoot = (root: string): string => {
    let id = rootToId.get(root);
    if (!id) {
      id = `net${rootToId.size}`;
      rootToId.set(root, id);
      members.set(id, []);
    }
    return id;
  };
  for (const wire of document.wires)
    idOfRoot(uf.ensure(keyOfEndpoint(document, wire.from, "from")));
  for (const key of uf.keys()) {
    const id = idOfRoot(uf.ensure(key));
    netOfKey.set(key, id);
    members.get(id)!.push(key);
  }
  const wireNetwork = new Map<string, string>();
  const networkWires = new Map<string, string[]>();
  for (const wire of document.wires) {
    const id = netOfKey.get(
      keyOfEndpoint(document, wire.from, "from"),
    )!;
    wireNetwork.set(wire.id, id);
    const list = networkWires.get(id) ?? [];
    list.push(wire.id);
    networkWires.set(id, list);
  }
  const networks: ResolvedNetwork[] = [...rootToId.values()].map((id) => ({
    id,
    keys: members.get(id) ?? [],
    wires: networkWires.get(id) ?? [],
    points: networkPoints(document, members.get(id) ?? []),
  }));
  return { netOfKey, members, wireNetwork, networks };
}

function networkPoints(
  document: CircuitDocument,
  keys: string[],
): Point[] {
  const points: Point[] = [];
  for (const key of keys) {
    const pin = parsePinKey(key);
    if (pin.direction === "junction") {
      const junction = document.junctions?.find(
        (item) => item.id === pin.ownerId,
      );
      if (junction) points.push({ x: junction.x, y: junction.y });
      continue;
    }
    const node = document.nodes.find((item) => item.id === pin.ownerId);
    if (!node) continue;
    if (node.kind === "BUS")
      points.push({
        x: node.x + BOARD.nodeWidth / 2,
        y: node.y + BOARD.nodeHeight / 2,
      });
    else if (pin.direction === "out")
      points.push(portPoint(node, "output", pin.port));
  }
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 网络中真正的驱动源端点（BUS 与汇接点无源，不计入） */
export function networkDrivers(
  document: CircuitDocument,
  model: NetworkModel,
  networkId: string,
): Endpoint[] {
  const keys = model.members.get(networkId) ?? [];
  return keys
    .map(parsePinKey)
    .filter((pin) => {
      if (pin.direction !== "out") return false;
      const node = document.nodes.find((item) => item.id === pin.ownerId);
      return !!node && node.kind !== "BUS";
    })
    .map((pin) => ({ nodeId: pin.ownerId, port: pin.port }));
}
/** 网络中真正的接收端输入端口（BUS 输入端口属于短接结构，不计入） */
export function networkReceivers(
  document: CircuitDocument,
  model: NetworkModel,
  networkId: string,
): Endpoint[] {
  const keys = model.members.get(networkId) ?? [];
  return keys
    .map(parsePinKey)
    .filter((pin) => {
      if (pin.direction !== "in") return false;
      const node = document.nodes.find((item) => item.id === pin.ownerId);
      return !!node && node.kind !== "BUS";
    })
    .map((pin) => ({ nodeId: pin.ownerId, port: pin.port }));
}
