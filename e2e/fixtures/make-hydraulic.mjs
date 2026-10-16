// Gera um projeto eletro-hidráulico de exemplo: unidade hidráulica, 4/3 tandem, cilindro, S1/S2 → Y1/Y2.
const comps = [];
const wires = [];
let n = 0;
const add = (type, x, y, label = "", params = {}) => {
  const id = `k${n++}`;
  comps.push({ id, type, x, y, rotation: 0, mirrored: false, label, params });
  return id;
};
const wire = (a, pa, b, pb) => wires.push({ id: `w${wires.length}`, from: { componentId: a, portId: pa }, to: { componentId: b, portId: pb }, waypoints: [] });
const cyl = add("hyd.cylinder.double-acting", 40, 0, "A1", { pistonDiameter: 40, rodDiameter: 22, stroke: 200, load: 0, maxPressure: 210, mass: 20 }); // k0
const valve = add("hyd.valve.4-3-tandem.solenoid", 20, 140, "V1", { switchTime: 20, nominalFlow: 30, solenoidLeft: "Y1", solenoidRight: "Y2" }); // k1
const pump = add("hyd.pump.fixed", 0, 300, "P1", { displacement: 8, speed: 1450, maxPressure: 250 }); // k2
const relief = add("hyd.valve.relief", 140, 290, "V2", { setPressure: 100, nominalFlow: 60 }); // k3
const gauge = add("hyd.gauge.pressure", 260, 250, "M1", { range: 250 }); // k4
const tank1 = add("hyd.tank", 30, 420); // k5
const tank2 = add("hyd.tank", 150, 420); // k6
const tank3 = add("hyd.tank", 240, 300); // k7
wire(tank1, "T", pump, "S");
wire(pump, "P", valve, "P");
wire(pump, "P", relief, "P");
wire(relief, "T", tank2, "T");
wire(valve, "T", tank3, "T");
wire(valve, "A", cyl, "A");
wire(valve, "B", cyl, "B");
wire(pump, "P", gauge, "1");
// elétrica: S1 → Y1 (avança), S2 → Y2 (recua)
const p1 = add("elec.supply.24v", 420, 0); // k8
const s1 = add("elec.pushbutton.no", 420, 80, "S1"); // k9
const y1 = add("elec.solenoid.coil", 420, 180, "Y1"); // k10
const z1 = add("elec.supply.0v", 420, 270); // k11
const p2 = add("elec.supply.24v", 520, 0); // k12
const s2 = add("elec.pushbutton.no", 520, 80, "S2"); // k13
const y2 = add("elec.solenoid.coil", 520, 180, "Y2"); // k14
const z2 = add("elec.supply.0v", 520, 270); // k15
wire(p1, "+", s1, "1");
wire(s1, "2", y1, "A1");
wire(y1, "A2", z1, "0");
wire(p2, "+", s2, "1");
wire(s2, "2", y2, "A1");
wire(y2, "A2", z2, "0");
const project = { id: "p_hyd", name: "Eletro-hidráulica 4/3 tandem", circuits: [{ id: "c1", name: "Circuito 1", components: comps, connections: wires }], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
process.stdout.write(JSON.stringify({ format: "fluxolab", version: 1, savedAt: project.updatedAt, project }, null, 2));
