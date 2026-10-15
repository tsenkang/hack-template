import type { ComponentDef } from "../types";
import { ContactNC, ContactNO, ELEC_H, ELEC_W, PushOperator } from "./draw";

const TERMINALS = [
  { id: "1", x: 20, y: 0, kind: "electric" },
  { id: "2", x: 20, y: ELEC_H, kind: "electric" },
] as const;

const base = {
  domain: "electric",
  category: "elec-switches",
  width: ELEC_W,
  height: ELEC_H,
  params: [],
} as const;

export const pushbuttonNO: ComponentDef = {
  ...base,
  type: "elec.pushbutton.no",
  labelPrefix: "S",
  ports: [...TERMINALS],
  keywords: ["botão", "liga", "start", "pulsador", "na"],
  Symbol: () => (
    <g>
      <ContactNO />
      <PushOperator />
    </g>
  ),
};

export const pushbuttonNC: ComponentDef = {
  ...base,
  type: "elec.pushbutton.nc",
  labelPrefix: "S",
  ports: [...TERMINALS],
  keywords: ["botão", "desliga", "stop", "pulsador", "nf"],
  Symbol: () => (
    <g>
      <ContactNC />
      <PushOperator />
    </g>
  ),
};

export const relayContactNO: ComponentDef = {
  ...base,
  type: "elec.relay.contact-no",
  labelPrefix: "K",
  ports: [...TERMINALS],
  keywords: ["relé", "contato", "selo", "na"],
  Symbol: () => <ContactNO />,
};

export const relayContactNC: ComponentDef = {
  ...base,
  type: "elec.relay.contact-nc",
  labelPrefix: "K",
  ports: [...TERMINALS],
  keywords: ["relé", "contato", "intertravamento", "nf"],
  Symbol: () => <ContactNC />,
};
