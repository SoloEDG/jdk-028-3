import { ref } from "vue";
import type {
  CircuitDocument,
  GateKind,
  GateNode,
  Junction,
  PlacementKind,
  Point,
} from "@/shared/types";
import { createId } from "@/shared/document";

export function usePlacement() {
  const tool = ref<PlacementKind | null>(null);

  function createNode(
    document: CircuitDocument,
    kind: GateKind,
    position: Point,
  ): GateNode {
    const peers = document.nodes.filter((node) => node.kind === kind);
    const label = labelFor(document, kind, peers.length);
    return {
      id: createId("node"),
      kind,
      label,
      value: 0,
      x: position.x,
      y: position.y,
    };
  }

  function createJunction(
    document: CircuitDocument,
    position: Point,
  ): Junction {
    const id = createId("junction");
    document.junctions = [...(document.junctions ?? []), { id, ...position }];
    return { id, ...position };
  }

  return { tool, createNode, createJunction };
}

function labelFor(
  document: CircuitDocument,
  kind: GateKind,
  peerCount: number,
): string {
  if (kind === "INPUT")
    return (
      ["A", "B", "C", "D"].find(
        (name) => !document.nodes.some((node) => node.label === name),
      ) ?? `I${peerCount + 1}`
    );
  if (kind === "OUTPUT")
    return peerCount ? `Y${peerCount + 1}` : "Y";
  if (kind === "TRI") return `TS${peerCount + 1}`;
  if (kind === "BUS") return peerCount ? `BUS ${peerCount + 1}` : "BUS 1";
  if (kind === "PROBE") return `P${peerCount + 1}`;
  return `${kind} ${peerCount + 1}`;
}
