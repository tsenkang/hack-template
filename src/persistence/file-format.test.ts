import { describe, expect, it } from "vitest";
import { createProject } from "@/store/project-model";
import { FILE_VERSION, parseProjectFile, serializeProject } from "./file-format";

describe("arquivo de projeto", () => {
  it("salva e lê de volta o mesmo projeto", () => {
    const project = createProject("Bancada 1");
    const result = parseProjectFile(serializeProject(project));
    expect(result).toEqual({ ok: true, project });
  });

  it("recusa JSON inválido, arquivo de outro programa e versão futura", () => {
    expect(parseProjectFile("{")).toMatchObject({ ok: false, error: "fileErrors.notJson" });
    expect(parseProjectFile('{"a":1}')).toMatchObject({ ok: false, error: "fileErrors.notFluxoLab" });
    expect(parseProjectFile(JSON.stringify({ format: "fluxolab", version: FILE_VERSION + 1 }))).toMatchObject({
      ok: false,
      error: "fileErrors.tooNew",
    });
  });

  it("recusa projeto corrompido", () => {
    const bad = { format: "fluxolab", version: FILE_VERSION, project: { id: "x", name: "y", circuits: [] } };
    expect(parseProjectFile(JSON.stringify(bad))).toMatchObject({ ok: false, error: "fileErrors.malformed" });
  });
});
