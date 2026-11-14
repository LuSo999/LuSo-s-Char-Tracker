# LuSo-s-Char-Tracker
I was not happy with any of the available character trackers, so i decided to have a spin at it.

Webová appka, která nahrazuje papírový character sheet pro D&D 5e (2014) a 5.5e (2024). Sama počítá odvozené hodnoty, hlídá zdroje a umí odpočinky a level up.

- Appka běží na <https://luso999.github.io/LuSo-s-Char-Tracker/>.
- Zadání je v `dnd-tracker-spec2.md` a plán v `docs/plan.md`.

**Appka je pro kamarády.** Postavy si může uložit kdokoli s Google účtem, ale sdílený obsah z oficiálních knih mimo SRD vidí jen e-maily, které správce pozve.

## Nastavení (jednorázově, ručně)

### 1. Založení Firebase projektu

1. Otevři <https://console.firebase.google.com> a přihlas se osobním Google účtem.
2. Klikni na **Create a project** (nebo **Add project**) a zadej název, třeba `luso-char-tracker`. Google Analytics můžeš vypnout, appka je nepotřebuje.

### 2. Zapnutí přihlášení přes Google

1. V levém menu otevři **Build → Authentication** a klikni na **Get started**.
2. Na záložce **Sign-in method** zvol **Google**, přepni ho na **Enable**, vyber podpůrný e-mail a dej **Save**.
3. Na záložce **Settings → Authorized domains** klikni na **Add domain** a zadej `luso999.github.io`. Doména `localhost` tam už je, takže lokální vývoj funguje bez dalšího nastavení.

### 3. Zapnutí Firestore

1. V levém menu otevři **Build → Firestore Database** a klikni na **Create database**.
2. Jako umístění zvol evropské, třeba `eur3 (europe-west)`. Později už ho nejde změnit.
3. Zvol **Start in production mode**.
4. Na záložce **Rules** nahraď obsah textem ze souboru [`firestore.rules`](firestore.rules) a klikni na **Publish**. Totéž udělej při každé změně tohoto souboru.

Bezplatný tarif Spark na tuhle appku bohatě stačí.

### 4. Vložení konfigurace do appky

1. Klikni na ozubené kolo vedle **Project Overview** a otevři **Project settings**.
2. Dole v části **Your apps** klikni na ikonu webu `</>`, zadej název appky a dej **Register app**. Firebase Hosting nezaškrtávej.
3. Zobrazí se objekt `firebaseConfig`. Jeho hodnoty vlož do [`src/firebase/config.ts`](src/firebase/config.ts), nebo je pošli Claude Code, který je vloží za tebe.

Tyhle hodnoty nejsou tajné. Patří do klientského kódu každé Firebase appky. Data chrání pravidla Firestore: každý uživatel smí číst a zapisovat jen pod `users/{své uid}/`.

### 5. Zapnutí GitHub Pages

1. V repozitáři otevři **Settings → Pages**.
2. V části **Build and deployment → Source** zvol **GitHub Actions**.

Každý push do větve `main` pak appku sestaví, otestuje a nasadí. Průběh je vidět na záložce **Actions**.

### 6. Sdílený oficiální obsah (jen správce)

Obsah z placených knih mimo SRD se do repa nedává. Leží jen u správce ve složce `private/packs/`, kterou Git ignoruje.

1. Spusť `npm run content:merge`. Skript balíčky zkontroluje, vypíše jejich obsah (neověřené položky označí „?“) a vytvoří `private/official-content.json`.
2. V appce otevři **Nastavení → Správa obsahu** a soubor nahraj.
3. Ve stejném místě nastav, kdo obsah uvidí. Výchozí je jen pro pozvané e-maily.

Správci jsou určení svými UID v `firestore.rules` a v `src/config.ts`. Po změně `firestore.rules` je potřeba pravidla znovu publikovat (krok 3.4).

## Desktopová appka

Ve složce `desktop/` je program pro Windows, macOS a Linux (Electron). Vyplní postavou libovolný character sheet a umí to i obráceně: přečte vyplněný sheet do souboru pro import. Analýzu dělá Claude (vlastní API klíč) a bez klíče funguje místní záloha. Instalátory jsou v [Releases](https://github.com/LuSo999/LuSo-s-Char-Tracker/releases), podrobnosti v [docs/desktop-app.md](docs/desktop-app.md).

## Lokální vývoj

Potřebuješ Node.js 24. Na Fedoře ho nainstaluješ příkazem `sudo dnf install nodejs24 nodejs24-npm`.

```
npm install
npm run dev      # vývojový server na http://localhost:5173/LuSo-s-Char-Tracker/
npm test         # testy
npm run build    # produkční build do dist/
npm run build:srd       # znovu převede SRD data (scripts/build-srd.ts)
npm run content:merge   # sloučí soukromé balíčky pro nahrání
```

Ve vývojovém režimu je na `#/dev` náhled listu bez přihlášení (v produkci neexistuje).

## Licence obsahu a uvedení zdroje

This work includes material from the System Reference Document 5.1 ("SRD 5.1") and the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The SRD 5.1 and SRD 5.2 are licensed under the Creative Commons Attribution 4.0 International License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

Strojově čitelná SRD data pocházejí z projektu [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api) (kód pod licencí MIT).

V tomhle repozitáři je jen obsah ze SRD. Obsah z placených knih sem nepatří.
