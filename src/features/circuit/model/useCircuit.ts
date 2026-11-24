import { ref, type Ref } from "vue";
import type { CircuitDocument } from "@/shared/types";
import type { PortRequest, Notice } from "@/shared/commands";
import { isJunctionId, removeNode } from "@/shared/document";
import { connect } from "./connections";

export function useCircuit(
  document: Ref<CircuitDocument>,
  notify: (notice: Notice) => void,
) {
  const selected = ref<string | null>(null),
    pending = ref<PortRequest | null>(null);
  function resetSelection() {
    selected.value = null;
    pending.value = null;
  }
  function pickPort(port: PortRequest) {
    const junction = isJunctionId(document.value, port.nodeId);
    // 已有待接输出时，点击汇接点视为目标端点，完成连接
    if (junction && pending.value) {
      const target = { nodeId: port.nodeId, port: 0 };
      const error = connect(document.value, pending.value, target);
      if (error) notify({ tone: "error", message: error });
      else {
        pending.value = null;
        notify({ tone: "success", message: "已并入汇接点，网络已更新" });
      }
      return;
    }
    if (port.direction === "output" || junction) {
      pending.value = port;
      notify({
        tone: "info",
        message: junction
          ? "已选择汇接点，请点击要并入同一网络的输入端口或汇接点"
          : "已选择输出端口，请点击一个输入端口",
      });
      return;
    }
    if (!pending.value) {
      notify({ tone: "error", message: "请先点击元件右侧的输出端口或汇接点" });
      return;
    }
    const error = connect(document.value, pending.value, port);
    if (error) notify({ tone: "error", message: error });
    else {
      pending.value = null;
      notify({ tone: "success", message: "连接成功，信号已更新" });
    }
  }
  function deleteSelected() {
    if (!selected.value) return;
    const isJunction = isJunctionId(document.value, selected.value);
    const isWire = document.value.wires.some(
      (wire) => wire.id === selected.value,
    );
    if (isWire)
      document.value.wires = document.value.wires.filter(
        (wire) => wire.id !== selected.value,
      );
    else
      // 删除元件或汇接点：只移除与它相连的线段，其他接收端仍留在原网络上
      removeNode(document.value, selected.value);
    resetSelection();
    notify({
      tone: "info",
      message: isJunction
        ? "已删除汇接点及其分支，其他接收端连接保持不变"
        : "已删除所选元件或连线",
    });
  }
  return { selected, pending, pickPort, deleteSelected, resetSelection };
}
