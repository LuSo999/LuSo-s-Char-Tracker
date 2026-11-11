# D&D Character Tracker – zadání pro Claude Code

## O co jde

Stavíme webovou appku, která nahrazuje papírový character sheet pro D&D: sama počítá odvozené hodnoty, hlídá zdroje (použití schopností, kostky, náboje předmětů) a umí level up a odpočinky podle pravidel zvolené edice. Používat ji bude hlavně jeden hráč u stolu na PC s velkým monitorem, občas na telefonu. Cílem je mít během hry na jedné obrazovce všechno, co postava právě může udělat, bez listování.

Appka podporuje dvě edice pravidel: **5e (2014)** a **5.5e (2024)**. Edice se volí pro každou postavu zvlášť a řídí všechny výpočty.

Autor zadání není zkušený programátor a bude výsledek průběžně zkoušet a připomínkovat. Proto pracuj po milnících (viz konec), po každém se zastav, shrň, co je hotové a jak to vyzkoušet, a počkej na zpětnou vazbu.

## Technologie a hosting

- React, TypeScript, Vite, Tailwind CSS.
- Firebase Authentication (přihlášení přes Google) a Firestore pro data uživatele.
- Hosting na GitHub Pages, nasazení přes GitHub Actions při pushi do `main`.
- GitHub Pages neumí přesměrování pro SPA a appka poběží na adrese s názvem repa v cestě. Nastav podle toho `base` ve Vite a použij hash router, jinak se po obnovení stránky rozbije routování.
- Firebase konfigurace v klientském kódu je veřejná, to je v pořádku. Bezpečnost stojí na Firestore Security Rules: každý uživatel smí číst a zapisovat jen dokumenty pod `users/{uid}/`. Pravidla ulož do repa.
- Zapni offline persistenci Firestore, u herního stolu bývá špatný signál.
- Do README sepiš kroky, které musí uživatel udělat ručně: založit Firebase projekt, zapnout Google přihlášení a Firestore, přidat doménu `<uživatel>.github.io` mezi autorizované domény, vložit konfiguraci a zapnout GitHub Pages.

Pokud bys chtěl některou z těchto voleb změnit, navrhni to a zdůvodni dřív, než začneš.

## Obsah pravidel: SRD a vlastní balíčky

Repo je veřejné, takže v něm smí být jen obsah z SRD, který je pod licencí CC-BY-4.0: SRD 5.1 pro 5e a SRD 5.2 pro 5.5e. Do repa, do kódu ani do ukázkových dat nepiš žádný obsah z placených knih mimo SRD (například subclass Battle Master a její manévry). Když si nejsi jistý, jestli něco v SRD je, ověř to v textu SRD, a pokud to nejde, nech to mimo.

- Najdi strojově čitelný zdroj SRD dat (existují komunitní projekty jako 5e-database nebo Open5e), ověř jeho aktuální stav, pokrytí obou edic a licenci, a navrhni, jak data převezmeš. Vestavěná data ulož v repu jako statické JSON soubory, appka nemá za běhu záviset na cizím API.
- Do appky a README přidej povinné uvedení zdroje podle CC-BY-4.0.

Všechno mimo SRD si uživatel doplní sám dvěma cestami, které pracují se stejným formátem dat:

1. **Editor v appce**: formuláře pro vytvoření a úpravu featury, subclass, předmětu, kouzla a zdroje.
2. **JSON balíčky**: import a export souboru s obsahem. Importovaný soubor validuj proti schématu (např. zod) a při chybě srozumitelně řekni, co je špatně.

Uživatelský obsah se ukládá jen do Firestore pod účet uživatele (`users/{uid}/packs`), nikdy do repa. Formát balíčku zdokumentuj v `docs/content-format.md` a přilož jeden ukázkový balíček s **vymyšleným** obsahem (vlastní homebrew subclass), aby bylo vidět, jak se zapisuje fond kostek, volitelné schopnosti a akce, které z fondu čerpají.

## Datový model

Drž odděleně dvě věci:

- **Obsah (pravidla)**: classy, subclass, featury, předměty, kouzla, stavy. Každá položka má `id`, `edition`, `type`, `name`, krátký `description`, `source` (název zdroje a `url`) a podle typu další pole: `actionType` (`action`, `bonusAction`, `reaction`, `other`), `uses` (maximum jako vzorec závislý na levelu, `resetOn`: `shortRest`, `longRest` a případně částečná obnova), `effects` (modifikátory, které položka přidává, např. +1 AC), `grantedAtLevel`.
- **Stav postavy** (`users/{uid}/characters/{id}`): edice, class a level (jako pole, aby šel později přidat multiclass), provedené volby, aktuální stav zdrojů, aktuální HP, inventář a nasazené předměty, ruční úpravy.

Odvozené hodnoty (AC, bonusy k útoku, saving throws, maximum HP, počty použití) se neukládají, vždy se počítají v tomto pořadí: základ z pravidel → modifikátory z featur a nasazených předmětů → ruční úpravy uživatele. Díky tomu se změna předmětu nebo levelu hned propíše všude a ruční úprava se neztratí.

Model musí unést tyto vzory, protože je první postava bude potřebovat: fond kostek, jehož velikost i typ kostky rostou s levelem; seznam voleb, ze kterých si hráč vybírá omezený počet; akce, která čerpá ze sdíleného fondu; save DC počítané vzorcem; předmět s vlastními náboji a obnovou.

## Engine pravidel

Výpočty napiš jako čisté TypeScript funkce v samostatném modulu bez závislosti na Reactu a pokryj je testy (Vitest). Rozdíly mezi edicemi řeš daty a malým počtem funkcí specifických pro edici, ne podmínkami rozesetými po UI.

Příklady rozdílů, které se týkají první postavy (Fighter). Ber je jako vodítko a každý ověř proti textu příslušného SRD:

- Second Wind: jiný počet použití a jiná obnova při short a long restu.
- Weapon Mastery a Tactical Mind existují jen v 5.5e.
- Long rest: jiná obnova Hit Dice.
- Vypití Potion of Healing: jiný typ akce.
- Exhaustion funguje jinak.
- Tvorba postavy: odkud se berou bonusy k ability scores a origin feat.

Když narazíš na pravidlo, které si nemůžeš ověřit, nehádej. Zeptej se, nebo položku označ v kódu a ve shrnutí milníku jako neověřenou.

## Rozložení obrazovky

Návrh je primárně pro PC a má využít celou šířku obrazovky. Na hlavní obrazovce je vidět vše důležité bez scrollování na běžném monitoru.

**Horní lišta:** jméno postavy, class, level a subclass, odznak edice, tlačítka Short rest, Long rest, Level up, přepínač vzhledu, přepínač jazyka, přepínač edit módu, přepnutí na jinou postavu.

**Levý sloupec:** ability scores s modifikátory, saving throws, skills (proficience zvýrazněné), proficiency bonus, passive Perception.

**Střed:**
- Řádek s HP (aktuální, maximum, temporary; rychlé ubrání a přidání), AC, Initiative, Speed, death saves.
- Seznam akcí, inspirovaný lištou akcí z Baldur's Gate 3. Obsahuje vše, co postava může právě udělat: útoky zbraněmi, útoky kouzly, schopnosti classy, použitelné předměty. Nad seznamem jsou filtry All, Action, Bonus action, Reaction, Other. Každý řádek ukazuje název, typ akce a spočítané hodnoty (bonus k útoku, damage, save DC, zbývající použití). Kliknutí na řádek, který něco stojí, odečte příslušný zdroj; vyčerpané akce jsou zašedlé, ale viditelné.
- Navrhované rozšíření: ukazatel ekonomiky tahu (Action, Bonus action, Reaction použito v tomto kole) s tlačítkem New turn.

**Pravý sloupec:** zdroje jako klikací tečky (např. Action Surge, Second Wind, fond kostek subclass, Hit Dice) s popiskem, kdy se obnovují; aktivní stavy (conditions); přehled featur.

**Pod sloupci:** panel Equipped s tím, co má postava na sobě a po ruce: zbraně, zbroj, štít, magické předměty, spotřební předměty. Magické předměty jsou odlišené, je vidět attunement (počet obsazených slotů ze tří) a náboje. Efekty nasazených předmětů se propisují do výpočtů.

**Výsuvné panely:** zleva Spellcasting (spell sloty, připravená kouzla, detail kouzla, koncentrace), zprava Inventory (batoh, peníze, váha, nasazení a sundání předmětu, attunement). Fighter bez kouzel má levý panel schovaný; připrav ho ale tak, aby šel zapnout pro sesílající subclass a classy.

**Telefon:** sloupce se skládají pod sebe, seznam akcí je nahoře hned pod HP, výsuvné panely jsou celoobrazovkové a otevírají se ze spodní lišty.

## Chování

**Ctrl+klik na pravidla.** Ctrl+klik (na Macu Cmd+klik) na jakoukoli položku, která pochází z pravidel, otevře v nové záložce `source.url` dané položky. Při držení Ctrl se klikatelné položky zvýrazní. Na telefonu totéž udělá dlouhý stisk nebo ikona v detailu. Položka bez odkazu nabídne jeho doplnění. Výchozí odkazy pro SRD obsah navrhni (jeden vzor URL pro celý balíček, s možností přepsat u položky) a nech je schválit.

**Edit mód.** Přepínač v horní liště. V edit módu jde přepsat cokoli: spočítané hodnoty, počty použití, názvy, popisy, odkazy. Ručně přepsaná hodnota je viditelně označená a jde jedním kliknutím vrátit na spočítanou. Mimo edit mód nejde omylem nic přepsat, jen používat (odečítat zdroje, měnit HP).

**Short rest a long rest.** Tlačítko otevře dialog, který ukáže, co se obnoví, a u short restu nabídne utracení Hit Dice. Po potvrzení se vše provede podle edice. Poslední odpočinek jde vrátit zpět.

**Level up.** Průvodce krok za krokem: přírůstek HP (průměr, nebo zadání hodu), nové featury, povinné volby (subclass, ASI nebo feat, výběr ze seznamu voleb). Před potvrzením ukaž souhrn změn. Ukládej historii level upů, aby šel poslední vrátit.

**Zpět.** Běžné akce (odečtení zdroje, změna HP) mají krátkodobé undo, protože u stolu se překlikne snadno.

## Vzhledy

Vzhled je sada design tokenů v CSS proměnných (barvy, font nadpisů, zaoblení) plus volitelné obrázky. Každý vzhled má vlastní složku s `theme.json`; přidání dalšího vzhledu má znamenat přidat složku, bez zásahu do komponent.

- Základní: `light`, `dark` (bez obrázků; výchozí se řídí nastavením systému).
- Tematické: `scroll`, `magic`, `holy`, `battlefield`, `forest`, `music`, `kraken`, `ship`, `smithy`, `ancient-temple`.

Obrázky jsou ve složce `theme-images/<id>/`, v každé podsložce dva: pozadí a textura. Názvy podsložek jsou zároveň id vzhledů; seznam vzhledů ber podle toho, jaké podsložky ve složce skutečně jsou. Pokud se soubory nejmenují `background` a `texture`, rozliš je podle poměru stran (širokoúhlý obrázek je pozadí, čtvercový textura). Soubor `theme-images-brief.md` popisuje, jak obrázky vznikly; názvy vzhledů v něm se mohou lišit, platí složky.

Barvy každého tematického vzhledu odvoď z jeho obrázků (dominantní barvy pozadí a textury), urči, jestli je vzhled světlý, nebo tmavý, a ověř kontrast textu vůči kartám. Návrh palet ukaž ke schválení.

Obrázky převeď do WebP, zmenši na rozumnou velikost a načítej až při zvolení vzhledu. Pozadí patří pod celou appku, textura na karty a výsuvné panely. Pod text vždy dej dostatečně krytou vrstvu, aby zůstal čitelný. Dokud obrázky nejsou dodané, použij místo nich přechod z barev vzhledu, ať na ně vývoj nečeká.

Zvolený vzhled se ukládá k účtu uživatele.

## Jazyky

Appka je dvojjazyčná: angličtina (výchozí) a čeština. Překládají se texty rozhraní (tlačítka, dialogy, nápovědy). Herní pojmy se nepřekládají ani v češtině: názvy kouzel, featur, předmětů, class, skills, conditions a typů akcí zůstávají anglicky tak, jak jsou v datech.

## Rozsah první verze

- Přihlášení, seznam postav, více postav na účet.
- Jedna class dotažená pořádně: **Fighter, level 1–20, obě edice**, se subclass Champion ze SRD.
- Vlastní obsah přes editor a JSON balíčky, aby si uživatel mohl doplnit svou subclass.
- Hlavní obrazovka, inventář, odpočinky, level up, edit mód, vzhledy, oba jazyky.

Nic nesmí být napevno svázané s Fighterem. Ostatní classy, multiclass a plné sesílání kouzel přijdou později a mají znamenat hlavně doplnění dat.

Mimo první verzi: sdílení postavy s DM, házení kostkami v appce, tvorba postavy od nuly pro jiné classy.

## Milníky

Po každém se zastav a počkej na zpětnou vazbu.

1. Kostra projektu, nasazení na GitHub Pages, přihlášení přes Google, Firestore pravidla, README s kroky nastavení.
2. Datový model, převzetí SRD dat pro Fightera v obou edicích, engine výpočtů s testy.
3. Hlavní obrazovka jen pro čtení s ukázkovou postavou, včetně filtrů akcí a Ctrl+kliku.
4. Interakce: HP, odečítání zdrojů, undo, short rest a long rest.
5. Inventář, nasazené předměty, attunement, propsání efektů do výpočtů.
6. Edit mód a ruční úpravy.
7. Level up.
8. Editor vlastního obsahu, import a export JSON balíčků, dokumentace formátu.
9. Vzhledy a přepínání jazyků.
10. Panel Spellcasting, doladění na telefonu.

Před milníkem 1 si přečti celé zadání, sepiš otázky a nejasnosti a navrhni strukturu projektu. Začni, až bude návrh odsouhlasený.
