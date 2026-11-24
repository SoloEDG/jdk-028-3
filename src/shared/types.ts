export type Signal = 0 | 1 | "X" | "Z";
export type GateKind =
  | "INPUT"
  | "OUTPUT"
  | "AND"
  | "OR"
  | "XOR"
  | "NOT"
  | "NAND"
  | "NOR"
  | "TRI"
  | "BUS"
  | "PROBE";
export type PlacementKind = GateKind | "JUNCTION";
export interface Point {
  x: number;
  y: number;
}
export interface GateNode extends Point {
  id: string;
  kind: GateKind;
  label: string;
  value: 0 | 1;
}
export interface Junction extends Point {
  id: string;
}
export interface Endpoint {
  /** 元件编号；当端点落在汇接点上时，保存汇接点编号（port 固定为 0） */
  nodeId: string;
  port: number;
}
export interface Wire {
  id: string;
  from: Endpoint;
  to: Endpoint;
}
export interface CircuitDocument {
  version: 1;
  name: string;
  nodes: GateNode[];
  wires: Wire[];
  targetId: string;
  /** 显式汇接点：只有汇接点（及 BUS 内部短接）才会合并网络，线路交叉不相连 */
  junctions?: Junction[];
}
export interface GateSpec {
  kind: GateKind;
  name: string;
  symbol: string;
  inputs: number;
  outputs: number;
  description: string;
}
export interface ConflictInfo {
  networkId: string;
  message: string;
  /** 实际参与冲突的发送端编号 */
  driverIds: string[];
  /** 冲突网络上的所有线段编号，用于高亮 */
  wireIds: string[];
  /** 冲突标注位置（BUS 本体或汇接点） */
  points: Point[];
}
export interface SimulationResult {
  values: Record<string, Signal>;
  pins: Record<string, Signal[]>;
  wires: Record<string, Signal>;
  order: string[];
  /** 每个电气网络的电平 */
  networks: Record<string, Signal>;
  /** 每段连线归属的网络编号（保存重开后由拓扑重新确定性计算） */
  wireNetwork: Record<string, string>;
  /** 总线竞争信息，随开关状态实时出现或消失 */
  conflicts: ConflictInfo[];
}
