# Desktopová appka – LuSo Sheet Tool (`desktop/`)

Program pro Windows, macOS a Linux. Ukazuje **celou webovou appku** (načítá ji z GitHub Pages, takže je vždy aktuální) a přidává k ní, co prohlížeč neumí: práci s AI pomocí API klíčů uložených v počítači a ukládání souborů.

Funkce navíc:

1. **Menu 📄 PDF** (v horní liště): vyplnění **libovolného** character sheetu (vyplňovací PDF, grafické PDF, sken, fotka) jednou z tvých postav nebo souborem postavy, šablony sheetů a nastavení AI.
2. **📄 PDF na sheetu postavy:** tlačítko „Vyplnit jiný sheet postavou …“ vyplní jiný sheet rovnou aktuální postavou.
3. **Tvorba postavy → „Založit z vyplněného character sheetu“:** skeny, fotky, grafické i ručně psané sheety přečte AI. Na webu tahle cesta funguje taky, ale jen pro vyplňovací PDF, a odkazuje na desktopovou appku.

## Stažení a první spuštění

Instalátory jsou na stránce **Releases** repozitáře: https://github.com/LuSo999/LuSo-s-Char-Tracker/releases

- **Windows:** `…-win-x64.exe`. Appka není podepsaná placeným certifikátem, takže SmartScreen napoprvé ukáže varování: *Další informace → Přesto spustit*.
- **macOS:** `…-mac-arm64.dmg` (Apple silicon) nebo `…-mac-x64.dmg` (Intel). Appka není podepsaná u Applu: napoprvé ji otevři přes *pravé tlačítko → Otevřít*. Když macOS hlásí „je poškozená“, pomůže v Terminálu `xattr -cr "/Applications/LuSo Sheet Tool.app"`.
- **Linux:** `…-linux-x86_64.AppImage`. Nastav mu právo spouštění (`chmod +x`) a spusť ho. Na NixOS je tu i `flake.nix` (`nix run github:LuSo999/LuSo-s-Char-Tracker`).

**Přihlášení:** Google nedovoluje přihlášení uvnitř aplikací. Tlačítko „Přihlásit“ v appce proto otevře tvůj prohlížeč (stránka `#/desktop-login`). Tam se přihlásíš a prohlížeč pošle přihlašovací údaje zpátky do appky přes jednorázovou místní adresu `http://127.0.0.1:<port>`, kterou appka ověří náhodným kódem. Pak už jsi v appce přihlášený (Firebase `signInWithCredential`).

## Vyplnění libovolného sheetu

1. Vyber postavu (z tvých postav nebo soubor `.luso-character.json`) a sheet (PDF nebo obrázky; obrázek se převede na stránku PDF).
2. **Šablona** (kam co patří):
   - Známý sheet (stejný soubor, nebo vestavěný oficiální 2024 sheet) se najde sám. Šablony se ukládají k účtu, takže jsou stejné na webu i v desktopu.
   - **🤖 Analyzovat** (vedle tlačítka je výběr AI): stránky (jako obrázky), formulářová pole s polohou, vytištěné popisky a katalog klíčů jdou vybrané AI. Vrátí přiřazení polí, rámečky pro text a tečky pro proficience. Výsledek se otevře v editoru.
   - **🔍 Jen místní analýza:** bez AI (`analyze.ts`). Pozná jen vyplňovací PDF, u grafických sheetů rozmístíš políčka ručně.
3. Editor šablony (`src/ui/export/TemplateEditor.tsx`) → **💾 Vyplnit a uložit PDF**.

## Založení postavy ze sheetu

1. Na stránce tvorby postavy otevři „📥 Založit z vyplněného character sheetu“ a vyber sheet (PDF nebo jeden či víc obrázků).
2. Vyplněná formulářová pole a text v rámečcích známé šablony se přečtou hned (`src/engine/export/readBack.ts`), na webu i v desktopu.
3. V desktopu jde sheet přečíst i pomocí **AI** (skeny, fotky, ručně psané sheety). Výsledek se sloučí s místně přečtenými hodnotami.
4. Dialog ukáže, co se spárovalo s obsahem, a postava se vytvoří. Nespárované věci skončí v poznámkách postavy.

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
- Posílá se jen obsah sheetu (a u exportu hodnoty postavy), jen vybrané AI a jen po stisknutí tlačítka. Volání běží v hlavním procesu (`desktop/electron/ai.cjs`), stránka klíče nikdy nevidí. Funkce appky (`window.luso`) dostane jen stránka webové appky, ostatní adresy se otevírají v prohlížeči. U OpenAI a Gemini se požadavek nenechává uložený u poskytovatele (`store: false`).
- Všechny tři dostávají stejný prompt a stejné JSON schéma (structured outputs). U Clauda je zapnutý server-side fallback (`fallbacks: "default"`): když bezpečnostní filtr odmítne, odpoví doporučený záložní model.
- ID modelů jsou v `desktop/renderer/providers.ts`. Až poskytovatelé vydají nové modely, stačí je změnit tam.

## Vývoj

```bash
cd desktop && npm ci              # Electron, electron-builder, SDK pro Claude, OpenAI a Gemini
npm start                         # appka s webem z GitHub Pages
npm run start:dev                 # appka s vývojovým serverem webu (npm run dev v kořeni, port 5173)
npm run dist                      # instalátor pro tento systém do desktop/release/
```

- `desktop/electron/main.cjs` je okno, klíče, soubory a přihlášení, `ai.cjs` volání AI a `preload.cjs` most `window.luso`. Webová strana mostu je v `src/desktop/` (`bridge.ts`, PDF nástroje, nastavení AI, založení postavy ze sheetu).
- Prompty, JSON schémata a převody odpovědí AI jsou v `src/engine/export/ai.ts`.
- Změny webu (i v `src/desktop/`) se do appky dostanou nasazením webu. Novou verzi desktopu stačí vydat jen při změně `desktop/`.

## Vydání nové verze

Zvyš `version` v `desktop/package.json`, commitni a pushni tag:

```bash
git tag desktop-v0.3.0 && git push origin desktop-v0.3.0
```

Workflow `.github/workflows/desktop.yml` sestaví instalátory na Windows, macOS a Linuxu a přiloží je k GitHub release. Ručně se dá spustit i z karty Actions, pak jsou instalátory jen v artefaktech běhu.
