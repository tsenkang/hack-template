"use client";

import { FileUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLocale, t } from "@/i18n";
import { deleteProject, listProjects, type SavedProjectInfo } from "@/persistence/storage";
import { useEditor } from "@/store/editor-store";
import { useUi } from "@/store/ui-store";
import { IconButton } from "./IconButton";
import { importProjectFile, openSavedProject } from "./project-actions";

/** Janela "Abrir projeto": projetos salvos neste navegador + importar arquivo .json. */
export function OpenDialog() {
  const open = useUi((s) => s.openDialog);
  const setOpen = useUi((s) => s.setOpenDialog);
  const currentId = useEditor((s) => s.project.id);
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<SavedProjectInfo[] | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      listProjects().then(setProjects, () => setProjects([]));
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const remove = async (p: SavedProjectInfo) => {
    if (!confirm(t("dialogs.confirmDelete", { name: p.name }))) return;
    await deleteProject(p.id);
    setProjects(await listProjects());
  };

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line p-4">
        <h2 className="font-semibold">{t("dialogs.openTitle")}</h2>
        <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => setOpen(false)}>
          {t("dialogs.close")}
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("dialogs.savedProjects")}</h3>
        {projects?.length === 0 && <p className="text-sm text-muted">{t("dialogs.noSaved")}</p>}
        <ul className="space-y-1">
          {projects?.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md border border-line">
              <button
                type="button"
                className="flex-1 px-3 py-2 text-left hover:bg-hover"
                onClick={() => openSavedProject(p.id)}
                aria-current={p.id === currentId}
              >
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted">
                  {t("dialogs.updatedAt", { date: new Date(p.updatedAt).toLocaleString(getLocale()) })}
                </span>
              </button>
              {p.id !== currentId && (
                <IconButton label={`${t("dialogs.delete")} ${p.name}`} onClick={() => remove(p)} className="mr-1">
                  <Trash2 size={16} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line p-4">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="import-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importProjectFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-hover"
        >
          <FileUp size={16} /> {t("dialogs.importFile")}
        </button>
      </div>
    </dialog>
  );
}
