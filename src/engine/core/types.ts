/**
 * Modelo de dados do circuito.
 *
 * Este arquivo não depende de React nem do navegador: é usado pela tela,
 * pelo motor de simulação (no Web Worker) e pelo formato de arquivo.
 */

/** Domínio físico de uma peça. */
export type Domain = "pneumatic" | "hydraulic" | "electric" | "logic";

export interface Point {
  x: number;
  y: number;
}

/** Rotação permitida para as peças (sempre múltiplos de 90°). */
export type Rotation = 0 | 90 | 180 | 270;

/** Valor de um parâmetro editável (pressão, curso, tempo…). */
export type ParamValue = number | string | boolean;

/** Uma peça colocada na área de desenho. */
export interface ComponentInstance {
  id: string;
  /** Identificador do tipo, ex.: "pneu.cylinder.double-acting". */
  type: string;
  /** Posição do canto superior esquerdo (antes da rotação), em unidades de mundo. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Espelhado na horizontal (antes da rotação). */
  mirrored: boolean;
  /** Rótulo exibido no desenho, ex.: "1A1", "K1". */
  label: string;
  params: Record<string, ParamValue>;
}

/** Extremidade de uma ligação: um conector de uma peça. */
export interface PortRef {
  componentId: string;
  portId: string;
}

/** Linha (tubo ou fio) entre dois conectores. Usada a partir da Fase 2. */
export interface Connection {
  id: string;
  from: PortRef;
  to: PortRef;
  /** Pontos intermediários do traçado (linhas em 90°). */
  waypoints: Point[];
}

/** Um circuito (uma aba): ex. "Potência" ou "Comando". */
export interface Circuit {
  id: string;
  name: string;
  components: ComponentInstance[];
  connections: Connection[];
}

/** Projeto completo, com uma ou mais abas de circuito. */
export interface Project {
  id: string;
  name: string;
  circuits: Circuit[];
  createdAt: string;
  updatedAt: string;
}
