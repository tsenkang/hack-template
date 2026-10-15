import { beforeEach, describe, expect, it } from "vitest";
import { selectActiveCircuit, useEditor } from "./editor-store";

const s = () => useEditor.getState();
const comps = () => selectActiveCircuit(s()).components;

beforeEach(() => s().newProject());

describe("editor", () => {
  it("insere peça na grade, com rótulo automático e parâmetros padrão", () => {
    s().addComponent("pneu.cylinder.double-acting", { x: 103, y: 47 });
    s().addComponent("pneu.cylinder.double-acting", { x: 300, y: 47 });
    const [a, b] = comps();
    expect(a.x % 10).toBe(0);
    expect(a.y % 10).toBe(0);
    expect([a.label, b.label]).toEqual(["A1", "A2"]);
    expect(a.params.stroke).toBe(100);
  });

  it("desfaz e refaz", () => {
    s().addComponent("pneu.source.air", { x: 0, y: 0 });
    s().addComponent("pneu.silencer", { x: 100, y: 0 });
    expect(comps()).toHaveLength(2);
    s().undo();
    expect(comps()).toHaveLength(1);
    s().undo();
    expect(comps()).toHaveLength(0);
    s().redo();
    expect(comps()).toHaveLength(1);
  });

  it("um arraste inteiro vira um único passo de desfazer", () => {
    const id = s().addComponent("pneu.source.air", { x: 0, y: 0 })!;
    const start = comps()[0];
    s().beginGesture();
    s().setPositions({ [id]: { x: 10, y: 0 } });
    s().setPositions({ [id]: { x: 20, y: 0 } });
    s().setPositions({ [id]: { x: 30, y: 0 } });
    s().endGesture();
    expect(comps()[0].x).toBe(30);
    s().undo();
    expect(comps()[0].x).toBe(start.x);
    expect(s().past).toHaveLength(1);
  });

  it("copia e cola com ids e rótulos novos", () => {
    s().addComponent("pneu.valve.3-2-nc.button-spring", { x: 0, y: 0 });
    s().copySelection();
    s().paste();
    const [a, b] = comps();
    expect(b.id).not.toBe(a.id);
    expect(b.label).toBe("V2");
    expect(b.x - a.x).toBe(20);
    expect(s().selection).toEqual([b.id]);
  });

  it("gira e espelha a seleção", () => {
    s().addComponent("pneu.cylinder.double-acting", { x: 200, y: 200 });
    s().rotateSelection();
    s().mirrorSelection();
    expect(comps()[0]).toMatchObject({ rotation: 90, mirrored: true });
  });

  it("exclui peças selecionadas", () => {
    s().addComponent("pneu.source.air", { x: 0, y: 0 });
    s().addComponent("pneu.silencer", { x: 100, y: 0 });
    s().selectAll();
    s().deleteSelection();
    expect(comps()).toHaveLength(0);
  });

  it("abas: cria, renomeia e remove, sempre mantendo uma aba válida", () => {
    s().addCircuit();
    expect(s().project.circuits).toHaveLength(2);
    const second = s().activeCircuitId;
    s().renameCircuit(second, "Comando");
    expect(selectActiveCircuit(s()).name).toBe("Comando");
    s().removeCircuit(second);
    expect(s().project.circuits).toHaveLength(1);
    expect(s().activeCircuitId).toBe(s().project.circuits[0].id);
    s().undo();
    expect(s().project.circuits).toHaveLength(2);
  });

  it("alinha à esquerda", () => {
    s().addComponent("pneu.source.air", { x: 100, y: 0 });
    s().addComponent("pneu.silencer", { x: 300, y: 200 });
    s().selectAll();
    s().alignSelection("left");
    const [a, b] = comps();
    expect(a.x).toBe(b.x);
  });
});

describe("linhas", () => {
  const circuit = () => selectActiveCircuit(s());

  it("liga dois conectores, sem duplicar nem ligar um conector nele mesmo", () => {
    const a = s().addComponent("pneu.source.air", { x: 0, y: 0 })!;
    const b = s().addComponent("pneu.silencer", { x: 100, y: 0 })!;
    expect(s().addConnection({ componentId: a, portId: "1" }, { componentId: b, portId: "1" })).not.toBeNull();
    expect(s().addConnection({ componentId: b, portId: "1" }, { componentId: a, portId: "1" })).toBeNull();
    expect(s().addConnection({ componentId: a, portId: "1" }, { componentId: a, portId: "1" })).toBeNull();
    expect(circuit().connections).toHaveLength(1);
  });

  it("apagar uma peça apaga as linhas dela; apagar a linha selecionada mantém as peças", () => {
    const a = s().addComponent("pneu.source.air", { x: 0, y: 0 })!;
    const b = s().addComponent("pneu.silencer", { x: 100, y: 0 })!;
    const w = s().addConnection({ componentId: a, portId: "1" }, { componentId: b, portId: "1" })!;
    s().select([w]);
    s().deleteSelection();
    expect(circuit().connections).toHaveLength(0);
    expect(circuit().components).toHaveLength(2);
    s().undo();
    s().select([b]);
    s().deleteSelection();
    expect(circuit().connections).toHaveLength(0);
  });

  it("copiar e colar leva junto as linhas entre as peças copiadas", () => {
    const a = s().addComponent("pneu.source.air", { x: 0, y: 0 })!;
    const b = s().addComponent("pneu.silencer", { x: 100, y: 0 })!;
    s().addConnection({ componentId: a, portId: "1" }, { componentId: b, portId: "1" });
    s().select([a, b]);
    s().copySelection();
    s().paste();
    expect(circuit().components).toHaveLength(4);
    expect(circuit().connections).toHaveLength(2);
    const copy = circuit().connections[1];
    expect(s().selection).toContain(copy.from.componentId);
  });
});
