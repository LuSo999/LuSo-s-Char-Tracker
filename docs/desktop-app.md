# Desktopová appka – LuSo Sheet Tool (`desktop/`)

Program pro Windows, macOS a Linux. Umí dvě věci:

1. **Postava → sheet:** vyplní **libovolný** character sheet (vyplňovací PDF, grafické PDF, sken, fotka) postavou z webové aplikace.
2. **Sheet → postava:** přečte vyplněný sheet (PDF, sken, fotky) a uloží soubor, který se naimportuje do webové aplikace.

## Stažení a první spuštění

Instalátory jsou na stránce **Releases** repozitáře: https://github.com/LuSo999/LuSo-s-Char-Tracker/releases

- **Windows:** `…-win-x64.exe`. Appka není podepsaná placeným certifikátem, takže SmartScreen napoprvé ukáže varování: *Další informace → Přesto spustit*.
- **macOS:** `…-mac-arm64.dmg` (Apple silicon) nebo `…-mac-x64.dmg` (Intel). Appka není podepsaná u Applu: napoprvé ji otevři přes *pravé tlačítko → Otevřít*. Když macOS hlásí „je poškozená“, pomůže v Terminálu `xattr -cr "/Applications/LuSo Sheet Tool.app"`.
- **Linux:** `…-linux-x86_64.AppImage`. Nastav mu právo spouštění (`chmod +x`) a spusť ho.

## Postava → sheet

1. Ve webové aplikaci otevři postavu → **📄 PDF** → **Soubor postavy pro desktopovou appku**. Stáhne se `<jméno>.luso-character.json` (formát `luso-character-export`, `src/engine/exchange.ts`). Obsahuje postavu, všechny spočítané hodnoty a katalog klíčů.
2. V appce vyber soubor postavy a sheet (PDF nebo obrázky; obrázek se převede na stránku PDF).
3. **Šablona** (kam co patří):
   - Už známý sheet (stejný soubor, nebo vestavěný oficiální 2024 sheet) se najde sám.
   - **🤖 Analyzovat** (vedle tlačítka je výběr AI): stránky (jako obrázky), formulářová pole s polohou, vytištěné popisky a katalog klíčů jdou vybrané AI. Vrátí přiřazení polí, rámečky pro text a tečky pro proficience. Výsledek se otevře v editoru.
   - **🔍 Jen místní analýza:** bez internetu, stejná jako na webu (`analyze.ts`). Pozná jen vyplňovací PDF, u grafických sheetů rozmístíš políčka ručně.
4. **Editor šablony** je stejný jako na webu (`src/ui/export/TemplateEditor.tsx`). Uložená šablona zůstane v počítači a příště se použije sama.
5. **💾 Vyplnit a uložit PDF.**

## Sheet → postava

1. Vyber vyplněný sheet (PDF, nebo jeden či víc obrázků: víc obrázků = víc stran).
2. **Místně** se přečtou vyplněná formulářová pole a text v rámečcích známé šablony. PDF vyplněné touto appkou nebo webem se tak přečte celé i bez Clauda (`src/engine/export/readBack.ts`).
3. **🤖 Přečíst** (výběr AI vedle tlačítka): přepíše, co je na sheetu (i ručně psané). Výsledek se sloučí s místně přečtenými hodnotami.
4. Zkontroluj jméno a edici a **💾 Ulož soubor pro import** (`<jméno>.luso-import.json`, formát `luso-sheet-import`).
5. Ve webové aplikaci: **Postavy → Import → soubor**. Dialog ukáže, co se spárovalo s obsahem (povolání, druh, kouzla, předměty…) a co ne. Nespárované věci skončí v poznámkách postavy.

## AI a API klíče

Appka umí tři AI. Stačí klíč k jedné z nich, zadává se v *Nastavení*:

| AI | Klíč | Nejpřesnější model | Levnější a rychlejší |
|---|---|---|---|
| Claude (Anthropic) | console.anthropic.com → API keys | Claude Opus 5.5 | Claude Sonnet 5.5 |
| ChatGPT (OpenAI) | platform.openai.com → API keys | GPT-6 Astra | GPT-6.1 Terra |
| Gemini (Google) | aistudio.google.com → Get API key | Gemini 4 Carbon | Gemini 4 Hydrogen |

- **Výchozí AI** se vybírá kolečkem v Nastavení, u každé AI i model (nejpřesnější / levnější). U tlačítek Analyzovat / Přečíst jde pro jednu analýzu zvolit jinou AI.
- Platí se z API kreditu účtu u poskytovatele podle jeho ceníku. Nejpřesnější modely stojí řádově desítky centů za sheet, levnější zlomek.
- Klíče zůstávají jen v počítači. Jsou zašifrované systémovou klíčenkou (Electron `safeStorage`), a pokud systém klíčenku nemá, uloží se nešifrovaně v datové složce appky. Fungují i proměnné prostředí `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` a `GEMINI_API_KEY` (nebo `GOOGLE_API_KEY`).
- Posílá se jen obsah sheetu (a u exportu hodnoty postavy), jen vybrané AI a jen po stisknutí tlačítka. Volání běží v hlavním procesu (`desktop/electron/ai.cjs`), stránka klíče nikdy nevidí. U OpenAI a Gemini se požadavek nenechává uložený u poskytovatele (`store: false`).
- Všechny tři dostávají stejný prompt a stejné JSON schéma (structured outputs). U Clauda je zapnutý server-side fallback (`fallbacks: "default"`): když bezpečnostní filtr odmítne, odpoví doporučený záložní model.
- ID modelů jsou v `desktop/renderer/providers.ts`. Až poskytovatelé vydají nové modely, stačí je změnit tam.

## Vývoj

```bash
npm ci                    # v kořeni repa (sdílený kód, Vite, React)
cd desktop && npm ci      # Electron, electron-builder, SDK pro Claude, OpenAI a Gemini
npm run build && npm start        # sestavit stránku a spustit appku
npm run dev & npm run start:dev   # vývoj s hot reloadem (Vite na portu 5299)
npm run dist              # instalátor pro tento systém do desktop/release/
```

- Stránka appky (`desktop/renderer`) importuje sdílený kód z `../src`: export engine, šablony, editor, texty. Testy sdíleného kódu běží s webem (`npm test` v kořeni).
- Prompty, JSON schémata a převody odpovědí jsou v `src/engine/export/ai.ts`, volání jednotlivých AI v `desktop/electron/ai.cjs`.

## Vydání nové verze

Zvyš `version` v `desktop/package.json`, commitni a pushni tag:

```bash
git tag desktop-v0.2.0 && git push origin desktop-v0.2.0
```

Workflow `.github/workflows/desktop.yml` sestaví instalátory na Windows, macOS a Linuxu a přiloží je k GitHub release. Ručně se dá spustit i z karty Actions, pak jsou instalátory jen v artefaktech běhu.
