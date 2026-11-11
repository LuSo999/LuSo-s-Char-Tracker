# Plán projektu

Platné zadání je v `dnd-tracker-spec2.md` (`dnd-tracker-spec.md` je původní verze, jen pro referenci). Tady jsou odsouhlasená rozhodnutí a struktura.

## Rozhodnutí

- **SRD data:** [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api) (`packages/5e-database/src/2014|2024/en`). Kód MIT, obsah CC-BY-4.0. Převezmou se texty; mechanika (vzorce použití, obnova, efekty) se dopíše ručně a ověří proti textu SRD. Neověřené položky se označí.
- **Efekty:** stálé efekty se počítají automaticky, podmíněné mají u akce přepínač „podmínka platí“.
- **Ctrl (Cmd) + najetí myší:** u kurzoru se zobrazí náhled pravidla z dat appky. Ctrl+klik otevře externí odkaz. Výchozí web: dnd2024.wikidot.com pro 5.5e a dnd5e.wikidot.com pro 5e. Alternativy v nastavení: Open5e, dandwiki.com, roll20.net. Odkaz u položky jde přepsat.
- **Git:** po každém milníku commit a push přímo do `main`, nasazení proběhne automaticky.
- **Firebase:** projekt na osobním Google účtu uživatele.
- **Přístup ke sdílenému oficiálnímu obsahu:** ve výchozím stavu jen pro pozvané e-maily (appka je pro kamarády). Bude uvedeno i v README.
- **Obsah z knih z roku 2025:** položky dostanou v datech příznak neověřeno. V UI je u nich malý štítek „new“. Ve shrnutí balíčku je i tak vypíšu ke kontrole.
- **Obrázky vzhledů:** soubory v `theme-images/magic/` byly prohozené, opraví se přejmenováním.
- **Technologie:** React, TypeScript, Vite, Tailwind, Firebase Auth (popup) + Firestore (Spark), npm, Zustand, zod, react-router (HashRouter), i18next, Vitest.

- **Historie:** přidat tlačítko pro začátek herního sezení a filtr podle typu události.

## Testovací postava

Valdric Greywing, Fighter 4 (5.5e), cantripy Mage Hand a Prestidigitation. Heavy Armor Master podle znění z 2024: snížení B/P/S poškození z útoků v heavy armor, bez slova „nonmagical“. Obsah mimo SRD (subclass, manévry, některé featy) se do repa nedává. Přijde přes sdílený oficiální obsah z balíčků v `private/packs/` (mimo git).

## Struktura

```
src/
  engine/        čisté TS funkce pro výpočty a pravidla (bez Reactu) + testy
    editions/    funkce specifické pro 5e / 5.5e
  content/       schémata obsahu (zod), načítání SRD + uživatelských balíčků
  data/srd/      vestavěná SRD data jako statický JSON (2014/, 2024/)
  state/         stav postavy, undo, synchronizace s Firestore
  firebase/      inicializace, přihlášení, offline persistence
  ui/            komponenty
  themes/        <id>/theme.json + WebP obrázky
  i18n/          en.json, cs.json
scripts/         převod SRD dat, převod obrázků, výpočet palet
docs/            plán, formát obsahu, ukázkový homebrew balíček
firestore.rules
.github/workflows/deploy.yml
```
