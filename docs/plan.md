# Plán projektu

Zadání je v `dnd-tracker-spec.md`. Tady jsou odsouhlasená rozhodnutí a struktura.

## Rozhodnutí

- **SRD data:** [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api) (`packages/5e-database/src/2014|2024/en`). Kód MIT, obsah CC-BY-4.0. Převezmou se texty; mechanika (vzorce použití, obnova, efekty) se dopíše ručně a ověří proti textu SRD. Neověřené položky se označí.
- **Efekty:** stálé efekty se počítají automaticky, podmíněné mají u akce přepínač „podmínka platí“.
- **Ctrl (Cmd) + najetí myší:** u kurzoru se zobrazí náhled pravidla z dat appky. Ctrl+klik otevře externí odkaz. Web pro odkazy jde zvolit v nastavení: výchozí návrh (ověří se v milníku 2), dále dnd2024.wikidot.com, dnd5e.wikidot.com, dandwiki.com, roll20.net. Odkaz u položky jde přepsat.
- **Git:** po každém milníku commit a push přímo do `main`, nasazení proběhne automaticky.
- **Firebase:** projekt na osobním Google účtu uživatele.
- **Obrázky vzhledů:** soubory v `theme-images/magic/` byly prohozené, opraví se přejmenováním.
- **Technologie:** React, TypeScript, Vite, Tailwind, Firebase Auth (popup) + Firestore (Spark), npm, Zustand, zod, react-router (HashRouter), i18next, Vitest.

## Testovací postava

Valdric Greywing, Fighter 4 (5.5e). Obsah mimo SRD (subclass, manévry, některé featy) se do repa nedává. Bude v soukromém balíčku mimo git.

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
