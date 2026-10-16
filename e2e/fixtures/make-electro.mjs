// Gera um projeto eletropneumático de exemplo (selo + solenoide + sensor) para testes e capturas.
const comps = [];
const wires = [];
let n = 0;
const add = (type, x, y, label = "", params = {}) => {
  const id = `k${n++}`;
  comps.push({ id, type, x, y, rotation: 0, mirrored: false, label, params });
  return id;
};
const wire = (a, pa, b, pb) => wires.push({ id: `w${wires.length}`, from: { componentId: a, portId: pa }, to: { componentId: b, portId: pb }, waypoints: [] });
// coluna 1: S2 (desliga, NF) → S1 (liga, NA) → K1
const p1 = add("elec.supply.24v", 0, 0);
const s2 = add("elec.pushbutton.nc", 0, 60, "S2");
const s1 = add("elec.pushbutton.no", 0, 150, "S1");
const k1 = add("elec.relay.coil", 0, 240, "K1");
const z1 = add("elec.supply.0v", 0, 330);
// coluna 2: contato de selo K1 em paralelo com S1
const seal = add("elec.relay.contact-no", 100, 150, "K1");
// coluna 3: K1 → solenoide Y1
const p3 = add("elec.supply.24v", 200, 0);
const k1b = add("elec.relay.contact-no", 200, 150, "K1");
const y1 = add("elec.solenoid.coil", 200, 240, "Y1");
const z3 = add("elec.supply.0v", 200, 330);
// coluna 4: sensor reed no fim do curso → lâmpada
const p4 = add("elec.supply.24v", 300, 0);
const b1 = add("elec.sensor.reed", 300, 150, "B1", { cylinder: "A1", position: 100 });
const h1 = add("elec.lamp", 300, 240, "H1", { voltage: 24, color: "green" });
const z4 = add("elec.supply.0v", 300, 330);
// pneumática
const cyl = add("pneu.cylinder.double-acting", 480, 20, "A1", { pistonDiameter: 32, rodDiameter: 12, stroke: 100, load: 0, maxPressure: 10 });
const v = add("pneu.valve.5-2.solenoid-spring", 470, 170, "V1", { switchTime: 20, nominalFlow: 500, solenoidLeft: "Y1" });
const src = add("pneu.source.air", 570, 330, "P1", { pressure: 6 });
wire(p1, "+", s2, "1");
wire(s2, "2", s1, "1");
wire(s1, "2", k1, "A1");
wire(k1, "A2", z1, "0");
wire(s2, "2", seal, "1");
wire(seal, "2", k1, "A1");
wire(p3, "+", k1b, "1");
wire(k1b, "2", y1, "A1");
wire(y1, "A2", z3, "0");
wire(p4, "+", b1, "1");
wire(b1, "2", h1, "X1");
wire(h1, "X2", z4, "0");
wire(src, "1", v, "1");
wire(v, "4", cyl, "A");
wire(v, "2", cyl, "B");
const project = { id: "p_electro", name: "Eletropneumática com selo", circuits: [{ id: "c1", name: "Circuito 1", components: comps, connections: wires }], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
process.stdout.write(JSON.stringify({ format: "fluxolab", version: 1, savedAt: project.updatedAt, project }, null, 2));
