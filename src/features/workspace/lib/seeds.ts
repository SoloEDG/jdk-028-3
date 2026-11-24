import type { CircuitDocument } from "@/shared/types";
export function sampleCircuit(): CircuitDocument {
  return {
    version: 1,
    name: "我的异或电路",
    targetId: "xor",
    nodes: [
      { id: "a", kind: "INPUT", label: "A", value: 0, x: 60, y: 120 },
      { id: "b", kind: "INPUT", label: "B", value: 0, x: 60, y: 340 },
      { id: "or", kind: "OR", label: "OR 1", value: 0, x: 320, y: 120 },
      { id: "nand", kind: "NAND", label: "NAND 1", value: 0, x: 320, y: 340 },
      { id: "and", kind: "AND", label: "AND 1", value: 0, x: 580, y: 230 },
      { id: "y", kind: "OUTPUT", label: "Y", value: 0, x: 820, y: 230 },
    ],
    wires: [
      {
        id: "w1",
        from: { nodeId: "a", port: 0 },
        to: { nodeId: "or", port: 0 },
      },
      {
        id: "w2",
        from: { nodeId: "b", port: 0 },
        to: { nodeId: "or", port: 1 },
      },
      {
        id: "w3",
        from: { nodeId: "a", port: 0 },
        to: { nodeId: "nand", port: 0 },
      },
      {
        id: "w4",
        from: { nodeId: "b", port: 0 },
        to: { nodeId: "nand", port: 1 },
      },
      {
        id: "w5",
        from: { nodeId: "or", port: 0 },
        to: { nodeId: "and", port: 0 },
      },
      {
        id: "w6",
        from: { nodeId: "nand", port: 0 },
        to: { nodeId: "and", port: 1 },
      },
      {
        id: "w7",
        from: { nodeId: "and", port: 0 },
        to: { nodeId: "y", port: 0 },
      },
    ],
  };
}
/**
 * 共享总线示例：两个发送端经带使能的三态缓冲器轮流驱动同一根 BUS，
 * 多个探针 / 指示灯挂在汇接点分支上只读取电平。
 * 默认仅 EN1 有效；同时打开 EN1、EN2 且电平相反可观察竞争。
 */
export function busCircuit(): CircuitDocument {
  return {
    version: 1,
    name: "共享总线实验",
    targetId: "xor",
    nodes: [
      { id: "d1", kind: "INPUT", label: "D1", value: 1, x: 40, y: 90 },
      { id: "d2", kind: "INPUT", label: "D2", value: 0, x: 40, y: 300 },
      { id: "en1", kind: "INPUT", label: "EN1", value: 1, x: 40, y: 170 },
      { id: "en2", kind: "INPUT", label: "EN2", value: 0, x: 40, y: 380 },
      { id: "ts1", kind: "TRI", label: "TS1", value: 0, x: 250, y: 100 },
      { id: "ts2", kind: "TRI", label: "TS2", value: 0, x: 250, y: 310 },
      { id: "bus", kind: "BUS", label: "BUS 1", value: 0, x: 470, y: 205 },
      { id: "j1", kind: "PROBE", label: "P1", value: 0, x: 720, y: 110 },
      { id: "j2", kind: "PROBE", label: "P2", value: 0, x: 720, y: 230 },
      { id: "led", kind: "OUTPUT", label: "Y", value: 0, x: 720, y: 350 },
    ],
    junctions: [
      { id: "jx1", x: 660, y: 205 },
      { id: "jx2", x: 660, y: 110 },
      { id: "jx3", x: 660, y: 350 },
    ],
    wires: [
      { id: "b1", from: { nodeId: "d1", port: 0 }, to: { nodeId: "ts1", port: 0 } },
      { id: "b2", from: { nodeId: "en1", port: 0 }, to: { nodeId: "ts1", port: 1 } },
      { id: "b3", from: { nodeId: "d2", port: 0 }, to: { nodeId: "ts2", port: 0 } },
      { id: "b4", from: { nodeId: "en2", port: 0 }, to: { nodeId: "ts2", port: 1 } },
      // 两个三态发送端轮流驱动同一根 BUS（BUS 输入允许多路汇入）
      { id: "b5", from: { nodeId: "ts1", port: 0 }, to: { nodeId: "bus", port: 0 } },
      { id: "b6", from: { nodeId: "ts2", port: 0 }, to: { nodeId: "bus", port: 0 } },
      // BUS 输出经汇接点分出多条只读取分支（交叉不相连，汇接点才合并）
      { id: "b7", from: { nodeId: "bus", port: 0 }, to: { nodeId: "jx1", port: 0 } },
      { id: "b8", from: { nodeId: "jx1", port: 0 }, to: { nodeId: "jx2", port: 0 } },
      { id: "b9", from: { nodeId: "jx2", port: 0 }, to: { nodeId: "j1", port: 0 } },
      { id: "b10", from: { nodeId: "jx1", port: 0 }, to: { nodeId: "jx3", port: 0 } },
      { id: "b11", from: { nodeId: "jx3", port: 0 }, to: { nodeId: "led", port: 0 } },
      { id: "b12", from: { nodeId: "jx1", port: 0 }, to: { nodeId: "j2", port: 0 } },
    ],
  };
}
export function emptyCircuit(): CircuitDocument {
  return {
    version: 1,
    name: "未命名实验",
    targetId: "xor",
    nodes: [],
    wires: [],
  };
}
