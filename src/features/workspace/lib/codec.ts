import type {
  CircuitDocument,
  GateNode,
  Junction,
  Wire,
} from "@/shared/types";
import { getSpec } from "@/features/catalog";
import { resolveNetworks, topologicalOrder } from "@/features/circuit";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const TARGETS = ["xor", "and", "or"];
export function decodeDocument(text: string): CircuitDocument {
  if (text.length > 2_000_000)
    throw new Error("实验文件超过 2 MB，请缩小后再导入");
  const data: unknown = JSON.parse(text);
  if (
    !object(data) ||
    data.version !== 1 ||
    typeof data.name !== "string" ||
    data.name.length > 80 ||
    !TARGETS.includes(String(data.targetId)) ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.wires)
  )
    throw new Error("文件格式或版本不受支持");
  if (data.nodes.length > 120 || data.wires.length > 480)
    throw new Error("实验最多支持 120 个元件、480 条连线");
  const ids = new Set<string>();
  const nodes: GateNode[] = data.nodes.map((value) => {
    if (
      !object(value) ||
      typeof value.id !== "string" ||
      !value.id ||
      value.id.length > 100 ||
      ids.has(value.id) ||
      typeof value.kind !== "string" ||
      typeof value.label !== "string" ||
      value.label.length > 40 ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      (value.value !== 0 && value.value !== 1)
    )
      throw new Error("元件内容无效或编号重复");
    const spec = getSpec(value.kind);
    ids.add(value.id);
    if (
      Number(value.x) < 20 ||
      Number(value.x) > 880 ||
      Number(value.y) < 40 ||
      Number(value.y) > 420
    )
      throw new Error("元件坐标超出工作台范围");
    return {
      id: value.id,
      kind: spec.kind,
      label: value.label,
      x: Number(value.x),
      y: Number(value.y),
      value: value.value,
    };
  });
  // 汇接点为可选字段：旧单线实验没有该字段，导入后语义保持不变
  let junctions: Junction[] | undefined;
  if (data.junctions !== undefined) {
    if (!Array.isArray(data.junctions) || data.junctions.length > 200)
      throw new Error("汇接点数量最多 200 个");
    junctions = data.junctions.map((value) => {
      if (
        !object(value) ||
        typeof value.id !== "string" ||
        !value.id ||
        value.id.length > 100 ||
        ids.has(value.id) ||
        !Number.isFinite(value.x) ||
        !Number.isFinite(value.y)
      )
        throw new Error("汇接点内容无效或编号重复");
      ids.add(value.id);
      return {
        id: value.id,
        x: Number(value.x),
        y: Number(value.y),
      };
    });
  }
  const wireIds = new Set<string>(),
    occupied = new Set<string>();
  const wires: Wire[] = data.wires.map((value) => {
    if (
      !object(value) ||
      typeof value.id !== "string" ||
      !value.id ||
      ids.has(value.id) ||
      wireIds.has(value.id) ||
      !object(value.from) ||
      !object(value.to)
    )
      throw new Error("连线内容无效或编号重复");
    const fromId = String(value.from.nodeId),
      toId = String(value.to.nodeId);
    const fp = value.from.port,
      tp = value.to.port;
    if (!Number.isInteger(fp) || !Number.isInteger(tp))
      throw new Error("连线端口无效");
    const fromJunction = junctions?.some((j) => j.id === fromId);
    const toJunction = junctions?.some((j) => j.id === toId);
    const from = nodes.find((n) => n.id === fromId);
    const to = nodes.find((n) => n.id === toId);
    if (
      (!from && !fromJunction) ||
      (!to && !toJunction) ||
      fromId === toId
    )
      throw new Error("连线引用了无效端点");
    if (
      (from && Number(fp) < 0) ||
      (from && Number(fp) >= getSpec(from.kind).outputs) ||
      (to && Number(tp) < 0) ||
      (to && Number(tp) >= getSpec(to.kind).inputs)
    )
      throw new Error("连线引用了无效端口");
    // 普通输入端口仍只允许一条线；BUS 输入与汇接点支持多路汇入
    const allowsFanIn = toJunction || to?.kind === "BUS";
    const key = `${toId}:${tp}`;
    if (!allowsFanIn && occupied.has(key))
      throw new Error("同一输入端口不能连接两个输出");
    occupied.add(key);
    wireIds.add(value.id);
    return {
      id: value.id,
      from: { nodeId: fromId, port: Number(fp) },
      to: { nodeId: toId, port: Number(tp) },
    };
  });
  const document: CircuitDocument = {
    version: 1,
    name: data.name,
    targetId: String(data.targetId),
    nodes,
    wires,
  };
  if (junctions?.length) document.junctions = junctions;
  // 网络划分与无环校验：保证汇接关系可恢复且不引入反馈
  resolveNetworks(document);
  topologicalOrder(document);
  return document;
}
export function encodeDocument(document: CircuitDocument): string {
  // 汇接关系与各段信号归属随文档持久化（信号归属由网络拓扑确定性重建）
  return JSON.stringify(document, null, 2);
}
