import type { GateSpec } from "@/shared/types";
export const gateSpecs: readonly GateSpec[] = [
  {
    kind: "INPUT",
    name: "输入开关",
    symbol: "IN",
    inputs: 0,
    outputs: 1,
    description: "手动切换 0 / 1 信号",
  },
  {
    kind: "OUTPUT",
    name: "输出指示灯",
    symbol: "OUT",
    inputs: 1,
    outputs: 0,
    description: "观察电路末端的逻辑电平",
  },
  {
    kind: "AND",
    name: "与门",
    symbol: "&",
    inputs: 2,
    outputs: 1,
    description: "两个输入都为 1 时输出 1",
  },
  {
    kind: "OR",
    name: "或门",
    symbol: "≥1",
    inputs: 2,
    outputs: 1,
    description: "任一输入为 1 时输出 1",
  },
  {
    kind: "XOR",
    name: "异或门",
    symbol: "=1",
    inputs: 2,
    outputs: 1,
    description: "两个输入不同时输出 1",
  },
  {
    kind: "NOT",
    name: "非门",
    symbol: "1̅",
    inputs: 1,
    outputs: 1,
    description: "将输入电平取反",
  },
  {
    kind: "NAND",
    name: "与非门",
    symbol: "&̅",
    inputs: 2,
    outputs: 1,
    description: "与门结果取反",
  },
  {
    kind: "NOR",
    name: "或非门",
    symbol: "≥1̅",
    inputs: 2,
    outputs: 1,
    description: "或门结果取反",
  },
  {
    kind: "TRI",
    name: "三态缓冲器",
    symbol: "1▷EN",
    inputs: 2,
    outputs: 1,
    description:
      "EN=1 时把 IN 送到输出；EN=0 时输出高阻 Z，与总线断开；EN 未知时结果未知",
  },
  {
    kind: "BUS",
    name: "共享总线",
    symbol: "BUS",
    inputs: 1,
    outputs: 1,
    description:
      "允许多个三态发送端轮流驱动同一根线，输入输出内部短接；无驱动时为高阻 Z",
  },
  {
    kind: "PROBE",
    name: "分支探针",
    symbol: "P",
    inputs: 1,
    outputs: 0,
    description: "挂在总线分支上只读取电平，不参与驱动；可如实显示 0/1/X/Z",
  },
];
export function getSpec(kind: string): GateSpec {
  const spec = gateSpecs.find((item) => item.kind === kind);
  if (!spec) throw new Error(`未知元件类型：${kind}`);
  return spec;
}
