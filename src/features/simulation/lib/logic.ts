import type { GateKind, Signal } from "@/shared/types";
export function invert(value: Signal): Signal {
  // 高阻输入按未知处理：不能把悬空误判成确定的 0/1
  if (value === "X" || value === "Z") return "X";
  return value === 1 ? 0 : 1;
}
/** 逻辑门输入归一化：高阻 / 未知都不参与确定运算 */
export function gateInput(value: Signal | undefined): Signal {
  return value === 0 || value === 1 ? value : "X";
}
/**
 * 带使能端的三态缓冲器。
 * - EN = 1：输出 = IN
 * - EN = 0：输出高阻 Z，与总线断开
 * - EN = X：可能接通也可能断开；IN 已确定时按惯例输出 X（既不能当 Z 也不能当确定电平）
 * - EN 高阻按未知处理
 */
export function triState(input: Signal | undefined, enable: Signal): Signal {
  if (enable === 0) return "Z";
  if (enable === 1)
    return input === 0 || input === 1 ? input : "X";
  return "X";
}
export function gateValue(kind: GateKind, inputs: Signal[]): Signal {
  const values = inputs.map(gateInput);
  if (kind === "NOT") return invert(values[0] ?? "X");
  if (kind === "OUTPUT" || kind === "PROBE") {
    // 接收端如实显示高阻：目标检测不能把 Z 当成低电平通过
    return inputs[0] ?? "X";
  }
  if (kind === "AND" || kind === "NAND") {
    const value: Signal = values.includes(0)
      ? 0
      : values.includes("X")
        ? "X"
        : 1;
    return kind === "NAND" ? invert(value) : value;
  }
  if (kind === "OR" || kind === "NOR") {
    const value: Signal = values.includes(1)
      ? 1
      : values.includes("X")
        ? "X"
        : 0;
    return kind === "NOR" ? invert(value) : value;
  }
  if (kind === "XOR")
    return values.includes("X")
      ? "X"
      : values[0] === values[1]
        ? 0
        : 1;
  return "X";
}
