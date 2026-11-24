import type { CircuitDocument, Endpoint } from "@/shared/types";
import { getSpec } from "@/features/catalog";
import { createId } from "@/shared/document";
import {
  endpointOwner,
  isInputEndpoint,
  isOutputEndpoint,
  resolveNetworks,
} from "../lib/networks";
import { topologicalOrder } from "../lib/graph";

export function validateConnection(
  document: CircuitDocument,
  from: Endpoint,
  to: Endpoint,
): string | null {
  if (document.wires.length >= 480)
    return "最多支持 480 条连线，请先删除不用的连线";
  const source = endpointOwner(document, from),
    target = endpointOwner(document, to);
  if (source.kind === "junction" && target.kind === "junction")
    return "两个汇接点之间已自动同网，请直接连接到元件端口";
  if (source.kind === "node" && !source.node)
    return "元件已不存在，请重新选择端口";
  if (target.kind === "node" && !target.node)
    return "元件已不存在，请重新选择端口";
  if (from.nodeId === to.nodeId && source.kind === "node")
    return "不能将元件连接到自身";

  const sourceIsOutput =
    source.kind === "junction" || isOutputEndpoint(document, from);
  const targetIsInput =
    target.kind === "junction" || isInputEndpoint(document, to);
  if (!sourceIsOutput)
    return "请先点击元件右侧的输出端口（或汇接点）作为起点";
  if (!targetIsInput) return "目标必须是输入端口或汇接点";

  if (source.node && from.port >= getSpec(source.node.kind).outputs)
    return "请选择有效的输出端口";
  if (target.node && to.port >= getSpec(target.node.kind).inputs)
    return "请选择有效的输入端口";

  // BUS 输入端口与汇接点允许多路汇入；其余输入端口仍是单线
  const allowsFanIn =
    target.kind === "junction" || target.node?.kind === "BUS";
  if (
    !allowsFanIn &&
    document.wires.some(
      (w) => w.to.nodeId === to.nodeId && w.to.port === to.port,
    )
  )
    return "这个输入端口已有连线；共享驱动请接入 BUS 或汇接点";

  const candidate: CircuitDocument = {
    ...document,
    junctions: document.junctions ? [...document.junctions] : [],
    wires: [
      ...document.wires,
      { id: "candidate", from: { ...from }, to: { ...to } },
    ],
  };
  try {
    resolveNetworks(candidate);
    topologicalOrder(candidate);
  } catch (error) {
    return error instanceof Error ? error.message : "该连线不合法，请检查接线";
  }
  return null;
}
export function connect(
  document: CircuitDocument,
  from: Endpoint,
  to: Endpoint,
): string | null {
  const error = validateConnection(document, from, to);
  if (!error)
    document.wires.push({
      id: createId("wire"),
      from: { ...from },
      to: { ...to },
    });
  return error;
}
