import { useTranslation } from "react-i18next";
import type { ContentIndex } from "../../content";

/**
 * Which books' content a character may use (SRD is always on). An empty list
 * means every official book except unofficial / playtest ones.
 */
export function BooksPicker({
  content,
  books,
  onChange,
  legacy,
}: {
  content: ContentIndex;
  books: string[];
  onChange: (books: string[]) => void;
  /** 5.5e characters: allow 2014 subclasses. */
  legacy?: { on: boolean; onChange: (on: boolean) => void };
}) {
  const { t } = useTranslation();
  const all = content.withLegacySubclasses(!!legacy?.on).books();
  const legacyBox = legacy && content.edition === "2024" && (
    <label className="mb-2 flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={legacy.on}
        onChange={(e) => legacy.onChange(e.target.checked)}
      />
      <span>
        {t("books.legacy")}
        <span className="block text-xs text-muted">
          {t("books.legacyHint")}
        </span>
      </span>
    </label>
  );
  if (!all.length)
    return (
      <>
        {legacyBox}
        <p className="text-xs text-muted">{t("books.none")}</p>
      </>
    );
  const on = (id: string, defaultOff: boolean) =>
    books.length ? books.includes(id) : !defaultOff;
  const toggle = (id: string) => {
    const current = all.filter((b) => on(b.id, b.defaultOff)).map((b) => b.id);
    onChange(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };
  return (
    <>
      {legacyBox}
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        <li className="text-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled /> {t("books.srd")}
          </label>
        </li>
        {all.map((b) => (
          <li key={b.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={on(b.id, b.defaultOff)}
                onChange={() => toggle(b.id)}
              />
              {b.name}
              {b.defaultOff && (
                <span className="text-xs text-muted">
                  ({t("books.unofficial")})
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
