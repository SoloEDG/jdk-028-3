import assert from "node:assert/strict";
import type { CircuitDocument } from "../src/shared/types";
import { evaluate } from "../src/features/simulation/lib/evaluate";
import { triState } from "../src/features/simulation/lib/logic";
import { mergeSignals } from "../src/features/simulation/lib/bus";
import { resolveNetworks, pinKey } from "../src/features/circuit/lib/networks";
import { decodeDocument, encodeDocument } from "../src/features/workspace/lib/codec";
import { sampleCircuit, busCircuit } from "../src/features/workspace/lib/seeds";
import { truthTable } from "../src/features/challenge/lib/truthTable";
import { targetById } from "../src/features/challenge/lib/targets";
import { validateConnection } from "../src/features/circuit/model/connections";


let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}
function netIdOf(doc: CircuitDocument, nodeId: string, dir: "in" | "out", port = 0) {
  const id = resolveNetworks(doc).netOfKey.get(pinKey(nodeId, dir, port));
  assert.ok(id, `network of ${nodeId}`);
  return id!;
}
function setSwitch(doc: CircuitDocument, id: string, value: 0 | 1) {
  doc.nodes.find((n) => n.id === id)!.value = value;
}

/* ---------- 1. 四态合并格 ---------- */
check("无驱动 -> Z，Z 不会被当成 0", () => {
  assert.equal(mergeSignals([]), "Z");
  assert.equal(mergeSignals(["Z"]), "Z");
  assert.equal(mergeSignals(["Z", "Z"]), "Z");
});
check("单确定驱动给出确定电平", () => {
  assert.equal(mergeSignals([1]), 1);
  assert.equal(mergeSignals(["Z", 0]), 0);
  assert.equal(mergeSignals([0, "Z", "Z"]), 0);
});
check("相反有效电平 -> 竞争 X（不沿用最后接入者）", () => {
  assert.equal(mergeSignals([0, 1]), "X");
  assert.equal(mergeSignals([1, 0]), "X");
  assert.equal(mergeSignals([1, 1, 0]), "X");
});
check("相同有效电平 -> 该电平", () => {
  assert.equal(mergeSignals([1, 1]), 1);
  assert.equal(mergeSignals([0, 0]), 0);
});
check("未知使能贡献 X 时结果至少为 X", () => {
  assert.equal(mergeSignals(["X"]), "X");
  assert.equal(mergeSignals(["X", "Z"]), "X");
  assert.equal(mergeSignals([1, "X"]), "X");
});

/* ---------- 2. 三态缓冲器语义 ---------- */
check("TRI：EN=0 高阻；EN=1 透传；EN 未知 -> X", () => {
  assert.equal(triState(1, 0), "Z");
  assert.equal(triState(0, 0), "Z");
  assert.equal(triState(1, 1), 1);
  assert.equal(triState(0, 1), 0);
  assert.equal(triState(1, "X"), "X");
  assert.equal(triState(0, "Z"), "X");
});

/* ---------- 3. 共享总线完整求值 ---------- */
const bus = busCircuit();
check("默认只有 EN1=1：总线=D1=1，探针与灯全为 1，无冲突", () => {
  const r = evaluate(bus);
  assert.equal(r.networks[netIdOf(bus, "bus", "out")], 1);
  assert.equal(r.values["j1"], 1);
  assert.equal(r.values["j2"], 1);
  assert.equal(r.values["led"], 1);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.values["ts2"], "Z");
});
check("关闭 EN1、打开 EN2：总线改为 D2=0，发送端轮流驱动", () => {
  setSwitch(bus, "en1", 0);
  setSwitch(bus, "en2", 1);
  const r = evaluate(bus);
  assert.equal(r.networks[netIdOf(bus, "bus", "out")], 0);
  assert.equal(r.values["led"], 0);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.values["ts1"], "Z");
});
check("两个使能都关闭：总线高阻 Z，探针显示 Z 而不是 0", () => {
  setSwitch(bus, "en1", 0);
  setSwitch(bus, "en2", 0);
  const r = evaluate(bus);
  assert.equal(r.networks[netIdOf(bus, "bus", "out")], "Z");
  assert.equal(r.values["j1"], "Z");
  assert.equal(r.values["j2"], "Z");
  assert.equal(r.values["led"], "Z");
  assert.equal(r.conflicts.length, 0);
});
check("两路同时有效且电平相反：竞争 X，且定位到 TS1/TS2", () => {
  setSwitch(bus, "en1", 1);
  setSwitch(bus, "en2", 1);
  setSwitch(bus, "d1", 1);
  setSwitch(bus, "d2", 0);
  const r = evaluate(bus);
  assert.equal(r.networks[netIdOf(bus, "bus", "out")], "X");
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(
    [...r.conflicts[0].driverIds].sort(),
    ["ts1", "ts2"].sort(),
  );
  assert.ok(r.conflicts[0].message.includes("TS1"));
  assert.ok(r.conflicts[0].message.includes("TS2"));
});
check("两路同时有效但电平相同：不构成竞争", () => {
  setSwitch(bus, "d1", 1);
  setSwitch(bus, "d2", 1);
  const r = evaluate(bus);
  assert.equal(r.networks[netIdOf(bus, "bus", "out")], 1);
  assert.equal(r.conflicts.length, 0);
});
check("竞争随开关变化消失：关掉一路后冲突清零", () => {
  setSwitch(bus, "d2", 0);
  assert.equal(evaluate(bus).conflicts.length, 1);
  setSwitch(bus, "en2", 0);
  const after = evaluate(bus);
  assert.equal(after.conflicts.length, 0);
  assert.equal(after.networks[netIdOf(bus, "bus", "out")], 1);
});
check("使能未知：可能接通或断开，总线标 X 并提示对应发送端", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "x-en",
    targetId: "xor",
    nodes: [
      { id: "d", kind: "INPUT", label: "D", value: 1, x: 0, y: 0 },
      { id: "t", kind: "TRI", label: "TS1", value: 0, x: 100, y: 0 },
      { id: "b", kind: "BUS", label: "BUS 1", value: 0, x: 260, y: 0 },
      { id: "p", kind: "PROBE", label: "P1", value: 0, x: 420, y: 0 },
    ],
    wires: [
      { id: "w1", from: { nodeId: "d", port: 0 }, to: { nodeId: "t", port: 0 } },
      // EN 脚悬空 -> X
      { id: "w3", from: { nodeId: "t", port: 0 }, to: { nodeId: "b", port: 0 } },
      { id: "w4", from: { nodeId: "b", port: 0 }, to: { nodeId: "p", port: 0 } },
    ],
  };
  const r = evaluate(doc);
  assert.equal(r.pins["t"][1], "X");
  assert.equal(r.values["t"], "X");
  assert.equal(r.networks[netIdOf(doc, "b", "out")], "X");
  assert.ok(r.conflicts.some((c) => c.driverIds.includes("t")));
});

/* ---------- 4. 汇接点：交叉不相连，只有汇接点合并 ---------- */
check("线路交叉不合并网络；汇接点才合并", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "j",
    targetId: "xor",
    nodes: [
      { id: "i1", kind: "INPUT", label: "A", value: 1, x: 0, y: 0 },
      { id: "i2", kind: "INPUT", label: "B", value: 0, x: 0, y: 80 },
      { id: "o1", kind: "OUTPUT", label: "Y", value: 0, x: 400, y: 0 },
      { id: "o2", kind: "OUTPUT", label: "Y2", value: 0, x: 400, y: 80 },
    ],
    junctions: [{ id: "j1", x: 250, y: 40 }],
    wires: [
      { id: "w1", from: { nodeId: "i1", port: 0 }, to: { nodeId: "j1", port: 0 } },
      { id: "w2", from: { nodeId: "j1", port: 0 }, to: { nodeId: "o1", port: 0 } },
      { id: "w3", from: { nodeId: "i2", port: 0 }, to: { nodeId: "o2", port: 0 } },
    ],
  };
  assert.equal(resolveNetworks(doc).networks.length, 2);
  const r = evaluate(doc);
  assert.equal(r.values["o1"], 1);
  assert.equal(r.values["o2"], 0);
});
check("删除一个分支接收端不会断掉其他接收端", () => {
  const doc = busCircuit();
  doc.nodes = doc.nodes.filter((n) => n.id !== "j1");
  doc.wires = doc.wires.filter((w) => w.to.nodeId !== "j1");
  const after = evaluate(doc);
  assert.equal(after.values["j2"], 1);
  assert.equal(after.values["led"], 1);
});
check("汇接点被删除后其分支断开，但不影响其他元件存在", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "j2",
    targetId: "xor",
    nodes: [
      { id: "i", kind: "INPUT", label: "A", value: 1, x: 0, y: 0 },
      { id: "o1", kind: "OUTPUT", label: "Y", value: 0, x: 400, y: 0 },
      { id: "o2", kind: "OUTPUT", label: "Y2", value: 0, x: 400, y: 80 },
    ],
    junctions: [{ id: "j1", x: 250, y: 40 }],
    wires: [
      { id: "w1", from: { nodeId: "i", port: 0 }, to: { nodeId: "j1", port: 0 } },
      { id: "w2", from: { nodeId: "j1", port: 0 }, to: { nodeId: "o1", port: 0 } },
      { id: "w3", from: { nodeId: "j1", port: 0 }, to: { nodeId: "o2", port: 0 } },
    ],
  };
  doc.junctions = doc.junctions!.filter((j) => j.id !== "j1");
  doc.wires = doc.wires.filter(
    (w) => w.from.nodeId !== "j1" && w.to.nodeId !== "j1",
  );
  assert.equal(doc.nodes.length, 3);
  const r = evaluate(doc);
  assert.equal(r.values["o1"], "X");
  assert.equal(r.values["o2"], "X");
});

/* ---------- 5. 普通输入端口单线，BUS/汇接点可多路汇入 ---------- */
check("普通输入端口拒绝第二个驱动；BUS 输入与汇接点允许", () => {
  const doc = busCircuit();
  assert.ok(
    validateConnection(doc, { nodeId: "ts1", port: 0 }, { nodeId: "led", port: 0 }),
  );
  assert.equal(
    validateConnection(doc, { nodeId: "ts1", port: 0 }, { nodeId: "bus", port: 0 }),
    null,
  );
  assert.equal(
    validateConnection(doc, { nodeId: "ts1", port: 0 }, { nodeId: "jx1", port: 0 }),
    null,
  );
});
check("反馈环仍被拒绝", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "loop",
    targetId: "xor",
    nodes: [
      { id: "a", kind: "INPUT", label: "A", value: 1, x: 0, y: 0 },
      { id: "n1", kind: "NOT", label: "NOT 1", value: 0, x: 200, y: 0 },
      { id: "n2", kind: "NOT", label: "NOT 2", value: 0, x: 400, y: 0 },
    ],
    wires: [
      { id: "w1", from: { nodeId: "a", port: 0 }, to: { nodeId: "n1", port: 0 } },
      { id: "w2", from: { nodeId: "n1", port: 0 }, to: { nodeId: "n2", port: 0 } },
      // n2 输出接回 n1 输入，形成反馈环
      { id: "w3", from: { nodeId: "n2", port: 0 }, to: { nodeId: "n1", port: 0 } },
    ],
  };
  assert.throws(() => evaluate(doc), /反馈/);
});

/* ---------- 6. 旧单线语义保持，目标检测不把 Z 当 0 ---------- */
check("旧异或示例求值与真值表结果不变", () => {
  const doc = sampleCircuit();
  const r = evaluate(doc);
  assert.equal(r.values["y"], 0);
  const table = truthTable(doc, targetById("xor"));
  assert.equal(table.error, null);
  assert.ok(table.rows!.every((row) => row.matches));
  assert.equal(r.conflicts.length, 0);
});
check("高阻输出在目标检测中不被当作低电平通过", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "z",
    targetId: "and",
    nodes: [
      { id: "a", kind: "INPUT", label: "A", value: 0, x: 0, y: 0 },
      { id: "b", kind: "INPUT", label: "B", value: 0, x: 0, y: 80 },
      { id: "t", kind: "TRI", label: "TS1", value: 0, x: 200, y: 40 },
      { id: "y", kind: "OUTPUT", label: "Y", value: 0, x: 400, y: 40 },
    ],
    wires: [
      // 使能脚悬空（X）；数据接 A，输出经三态到 Y
      { id: "w1", from: { nodeId: "a", port: 0 }, to: { nodeId: "t", port: 0 } },
      { id: "w3", from: { nodeId: "t", port: 0 }, to: { nodeId: "y", port: 0 } },
    ],
  };
  // 使能未知 -> Y 为 X，先验证不会通过
  let table = truthTable(doc, targetById("and"));
  assert.equal(table.error, null);
  assert.ok(table.rows!.every((row) => row.matches === false));
  assert.equal(table.rows![0].actual, "X");

  // 用 B 作为常关使能（真值表首行 B=0），Y 变高阻 Z；AND 在 00 期望 0，但 Z 不得判通过
  doc.wires.push({
    id: "w2",
    from: { nodeId: "b", port: 0 },
    to: { nodeId: "t", port: 1 },
  });
  assert.equal(evaluate(doc).values["y"], "Z");
  table = truthTable(doc, targetById("and"));
  assert.equal(table.rows![0].matches, false);
  assert.equal(table.rows![0].actual, "Z");
});

/* ---------- 7. 保存重开保留汇接关系与各段信号归属 ---------- */
check("总线实验编码再解码：汇接点、网络归属、各段电平一致", () => {
  const doc = busCircuit();
  const restored = decodeDocument(encodeDocument(doc));
  assert.equal(restored.junctions?.length, 3);
  const m1 = resolveNetworks(doc);
  const m2 = resolveNetworks(restored);
  for (const wire of doc.wires)
    assert.equal(m1.wireNetwork.get(wire.id), m2.wireNetwork.get(wire.id));
  const r1 = evaluate(doc);
  const r2 = evaluate(restored);
  for (const wire of doc.wires)
    assert.equal(r1.wires[wire.id], r2.wires[wire.id]);
  assert.deepEqual(
    r2.conflicts.map((c) => [...c.driverIds].sort()),
    r1.conflicts.map((c) => [...c.driverIds].sort()),
  );
});
check("旧版无 junctions 字段文件可正常导入且语义不变", () => {
  const restored = decodeDocument(JSON.stringify(sampleCircuit()));
  assert.equal(restored.junctions, undefined);
  assert.equal(evaluate(restored).values["y"], 0);
});

/* ---------- 8. 悬空输入 / 使能的健壮性 ---------- */
check("TRI 使能脚悬空：求值为 X 且不抛异常，连接校验与编解码均通过", () => {
  const doc: CircuitDocument = {
    version: 1,
    name: "float",
    targetId: "xor",
    nodes: [
      { id: "d", kind: "INPUT", label: "D", value: 1, x: 40, y: 40 },
      { id: "t", kind: "TRI", label: "TS1", value: 0, x: 240, y: 40 },
      { id: "b", kind: "BUS", label: "BUS 1", value: 0, x: 440, y: 40 },
      { id: "p", kind: "PROBE", label: "P1", value: 0, x: 640, y: 40 },
    ],
    wires: [
      { id: "w1", from: { nodeId: "d", port: 0 }, to: { nodeId: "t", port: 0 } },
      { id: "w2", from: { nodeId: "t", port: 0 }, to: { nodeId: "b", port: 0 } },
      { id: "w3", from: { nodeId: "b", port: 0 }, to: { nodeId: "p", port: 0 } },
    ],
  };
  const r = evaluate(doc);
  assert.equal(r.pins["t"][1], "X");
  assert.equal(r.values["t"], "X");
  assert.equal(r.values["p"], "X");
  assert.equal(
    validateConnection(doc, { nodeId: "d", port: 0 }, { nodeId: "b", port: 0 }),
    null,
  );
  const restored = decodeDocument(JSON.stringify(doc));
  assert.equal(restored.nodes.length, 4);
});

console.log(`\n${passed} 项检查全部通过`);
