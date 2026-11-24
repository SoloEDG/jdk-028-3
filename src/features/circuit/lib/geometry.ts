import type { Endpoint, GateNode, Point } from "@/shared/types";
import { getSpec } from "@/features/catalog";
export const BOARD = {
  width: 1000,
  height: 520,
  nodeWidth: 112,
  nodeHeight: 86,
  junctionRadius: 8,
};
export function snapPosition(point: Point): Point {
  return {
    x: Math.round(Math.max(24, Math.min(864, point.x)) / 20) * 20,
    y: Math.round(Math.max(48, Math.min(412, point.y)) / 20) * 20,
  };
}
export function portPoint(
  node: GateNode,
  direction: "input" | "output",
  port = 0,
): Point {
  const count =
    direction === "input"
      ? getSpec(node.kind).inputs
      : getSpec(node.kind).outputs;
  return {
    x: node.x + (direction === "output" ? BOARD.nodeWidth : 0),
    y: node.y + (BOARD.nodeHeight * (port + 1)) / (count + 1),
  };
}
export function endpointPoint(
  document: {
    nodes: GateNode[];
    junctions?: { id: string; x: number; y: number }[];
  },
  endpoint: Endpoint,
  role: "from" | "to",
): Point | null {
  const junction = document.junctions?.find(
    (item) => item.id === endpoint.nodeId,
  );
  if (junction) return { x: junction.x, y: junction.y };
  const node = document.nodes.find((item) => item.id === endpoint.nodeId);
  if (!node) return null;
  // from 端是输出（元件右侧），to 端是输入（元件左侧）
  return role === "from"
    ? portPoint(node, "output", endpoint.port)
    : portPoint(node, "input", endpoint.port);
}
export function wirePath(from: Point, to: Point): string {
  const bend = Math.max(42, Math.abs(to.x - from.x) * 0.46);
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}
