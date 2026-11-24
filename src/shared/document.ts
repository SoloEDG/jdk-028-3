import type { CircuitDocument, GateNode, Junction } from "./types";
export function cloneDocument(document: CircuitDocument): CircuitDocument {
  return JSON.parse(JSON.stringify(document));
}
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
export function findNode(
  document: CircuitDocument,
  id: string,
): GateNode | undefined {
  return document.nodes.find((node) => node.id === id);
}
export function findJunction(
  document: CircuitDocument,
  id: string,
): Junction | undefined {
  return document.junctions?.find((junction) => junction.id === id);
}
export function isJunctionId(document: CircuitDocument, id: string): boolean {
  return !!document.junctions?.some((junction) => junction.id === id);
}
export function removeNode(document: CircuitDocument, id: string): void {
  document.nodes = document.nodes.filter((node) => node.id !== id);
  // 删除元件或汇接点时，只移走与它相连的线段；其他接收端仍挂在同一网络上
  document.wires = document.wires.filter(
    (wire) => wire.from.nodeId !== id && wire.to.nodeId !== id,
  );
  document.junctions = document.junctions?.filter(
    (junction) => junction.id !== id,
  );
}
