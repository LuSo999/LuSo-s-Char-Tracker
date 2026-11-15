# D&D Character Tracker – zadání pro Claude Code

## O co jde

Stavíme webovou appku, která nahrazuje papírový character sheet pro D&D: sama počítá odvozené hodnoty, hlídá zdroje (použití schopností, kostky, náboje předmětů) a umí level up a odpočinky podle pravidel zvolené edice. Používat ji budou hráči u stolu, hlavně na PC s velkým monitorem, občas na telefonu. Cílem je mít během hry na jedné obrazovce všechno, co postava právě může udělat, bez listování.

**Hlavní zásada:** appka je character sheet, wiki a kalkulačka v jednom. Má hráči odebrat co nejvíc práce s výrobou a vedením postavy, aby se mohl soustředit na hraní. Z toho plyne pro každou obrazovku:

- Kde pravidla dávají na výběr (kouzla, featy, skills, volby při level upu), hráč jen zaškrtává z nabídky možností, které jsou pro jeho postavu právě platné. Appka hlídá počty a nedovolí neplatnou volbu.
- Kde na výběr není, appka změnu provede sama.
- Hráč nikdy nic nepočítá ani neopisuje. Založení postavy je otázka pár kliků.
- U každé položky je po ruce náhled pravidla a detail, kdyby hráč tápal.

Když si při návrhu nejsi jistý, řiď se touto zásadou.

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

Cílem je, aby šla vytvořit libovolná postava z oficiálního obsahu podporovaných knih bez ručního zadávání. Editor slouží jen pro homebrew. Protože obsah mimo SRD nesmí být ve veřejném repu, řeš ho takto:

- Oficiální obsah mimo SRD připravuješ ty jako balíčky ve stejném formátu jako SRD data, ve složce `private/packs/`. Ta musí být v `.gitignore` dřív, než v ní vznikne první soubor, a nikdy se necommituje.
- Balíčky obsahují strukturovaná data mechanik (čísla, typy akcí, zdroje, postup po levelech, volby) a u každé položky krátké shrnutí vlastními slovy a `source.url`. Doslovný text z knih do nich nepiš; plné znění si uživatel otevře přes odkaz.
- Skript spojí balíčky do jednoho souboru `private/official-content.json`. Nahrává ho jen správce (majitel appky, určený svým UID ve Firestore pravidlech) na stránce Správa obsahu. Obsah se uloží do sdílené kolekce `content/official`, takže ho nikdo další importovat nemusí. Při nové verzi ho správce nahraje znovu.
- Sdílený obsah rozděl do dokumentů po balíčcích (limit Firestore je 1 MB na dokument) a na klientu ho cachuj, ať se nestahuje při každém spuštění.
- Sdílený obsah vidí každý přihlášený uživatel; tak to majitel appky chce. Připrav ale v nastavení správce přepínač, kterým jde přístup omezit na seznam pozvaných e-mailů (včetně odpovídajících Firestore pravidel), aby šel obsah v případě potřeby rychle uzavřít bez zásahu do kódu.
- Mechaniky píšeš z paměti, takže chyby jsou pravděpodobné. Po každém vytvoření nebo změně balíčku vypiš přehled toho, co jsi zapsal, a označ položky, kterými si nejsi jistý, aby je uživatel zkontroloval podle knihy.
- Podporované mají být postupně všechny oficiální knihy s hráčským obsahem. Pořadí: nejdřív oba Player's Handbooky (2014 a 2024), potom doplňky pro 5.5e: Eberron: Forge of the Artificer (včetně classy Artificer), Heroes of Faerûn a Adventures in Faerûn, potom Xanathar's Guide to Everything a Tasha's Cauldron of Everything a nakonec magické předměty z obou Dungeon Master's Guide, které nejsou v SRD. Další knihy v pořadí, které si odsouhlasíš s uživatelem. Z každé knihy ber jen obsah, který se týká postavy hráče (classy, subclass, species, backgrounds, featy, kouzla, předměty). Jeden balíček odpovídá jedné knize a každá položka nese údaj o knize a edici.
- Při tvorbě postavy jde zvolit, ze kterých knih se nabízí obsah, aby si skupina mohla nastavit, co u stolu povoluje.
- Dokud správce obsah nenahraje (a pro uživatele bez přístupu, pokud je omezení zapnuté), je k dispozici jen SRD obsah a appka to srozumitelně řekne.

Import souboru s obsahem přidej už v milníku 3, aby šla první postava zkoušet od začátku.

Pro homebrew jsou dvě cesty, které pracují se stejným formátem dat:

1. **Editor v appce**: formuláře pro vytvoření a úpravu featury, subclass, předmětu, kouzla a zdroje.
2. **JSON balíčky**: import a export souboru s obsahem. Importovaný soubor validuj proti schématu (např. zod) a při chybě srozumitelně řekni, co je špatně.

Uživatelský obsah se ukládá jen do Firestore pod účet uživatele (`users/{uid}/packs`), nikdy do repa. Formát balíčku zdokumentuj v `docs/content-format.md` a přilož jeden ukázkový balíček s **vymyšleným** obsahem (vlastní homebrew subclass), aby bylo vidět, jak se zapisuje fond kostek, volitelné schopnosti a akce, které z fondu čerpají.

## Datový model

Drž odděleně dvě věci:

- **Obsah (pravidla)**: classy, subclass, featury, předměty, kouzla, stavy. Každá položka má `id`, `edition`, `type`, `name`, krátký `description`, `source` (název zdroje a `url`) a podle typu další pole: `actionType` (`action`, `bonusAction`, `reaction`, `other`), `uses` (maximum jako vzorec závislý na levelu, `resetOn`: `shortRest`, `longRest` a případně částečná obnova), `effects` (modifikátory, které položka přidává, např. +1 AC), `grantedAtLevel`.
- **Stav postavy** (`users/{uid}/characters/{id}`): edice, classy a jejich levely (pole, kvůli multiclassu), provedené volby, aktuální stav zdrojů, aktuální HP, inventář a nasazené předměty, ruční úpravy.

Odvozené hodnoty (AC, bonusy k útoku, saving throws, maximum HP, počty použití) se neukládají, vždy se počítají v tomto pořadí: základ z pravidel → modifikátory z featur a nasazených předmětů → ruční úpravy uživatele. Díky tomu se změna předmětu nebo levelu hned propíše všude a ruční úprava se neztratí.

Model musí unést mimo jiné tyto vzory: fond kostek, jehož velikost i typ kostky rostou s levelem; seznam voleb, ze kterých si hráč vybírá omezený počet; akce, která čerpá ze sdíleného fondu; save DC počítané vzorcem; předmět s vlastními náboji a obnovou.

## Engine pravidel

Výpočty napiš jako čisté TypeScript funkce v samostatném modulu bez závislosti na Reactu a pokryj je testy (Vitest). Rozdíly mezi edicemi řeš daty a malým počtem funkcí specifických pro edici, ne podmínkami rozesetými po UI.

Příklady rozdílů na Fighterovi; u ostatních class jich bude víc. Ber je jako vodítko a každý ověř proti textu příslušného SRD:

- Second Wind: jiný počet použití a jiná obnova při short a long restu.
- Weapon Mastery a Tactical Mind existují jen v 5.5e.
- Long rest: jiná obnova Hit Dice.
- Vypití Potion of Healing: jiný typ akce.
- Exhaustion funguje jinak.
- Tvorba postavy: odkud se berou bonusy k ability scores a origin feat.

Když narazíš na pravidlo, které si nemůžeš ověřit, nehádej. Zeptej se, nebo položku označ v kódu a ve shrnutí milníku jako neověřenou.

## Rozložení obrazovky

Návrh je primárně pro PC a má využít celou šířku obrazovky. Na hlavní obrazovce je vidět vše důležité bez scrollování na běžném monitoru.

**Horní lišta:** jméno postavy, class, level a subclass, odznak edice, tlačítka Short rest, Long rest, Level up, přepínač vzhledu, přepínač jazyka, přepínač edit módu, historie, přepnutí na jinou postavu.

**Levý sloupec:** ability scores s modifikátory, saving throws, skills (proficience zvýrazněné), proficiency bonus, passive Perception.

**Střed:**
- Řádek s HP (aktuální, maximum, temporary; rychlé ubrání a přidání), AC, Initiative, Speed, death saves.
- Seznam akcí, inspirovaný lištou akcí z Baldur's Gate 3. Obsahuje vše, co postava může právě udělat: útoky zbraněmi, útoky kouzly, schopnosti classy, použitelné předměty. Nad seznamem jsou filtry All, Action, Bonus action, Reaction, Other. Každý řádek ukazuje název, typ akce a spočítané hodnoty (bonus k útoku, damage, save DC, zbývající použití). Kliknutí na řádek, který něco stojí, odečte příslušný zdroj; vyčerpané akce jsou zašedlé, ale viditelné.
- Navrhované rozšíření: ukazatel ekonomiky tahu (Action, Bonus action, Reaction použito v tomto kole) s tlačítkem New turn.

**Pravý sloupec:** zdroje jako klikací tečky (např. Action Surge, Second Wind, fond kostek subclass, Hit Dice) s popiskem, kdy se obnovují; aktivní stavy (conditions); přehled featur.

**Pod sloupci:** panel Equipped s tím, co má postava na sobě a po ruce: zbraně, zbroj, štít, magické předměty, spotřební předměty. Magické předměty jsou odlišené, je vidět attunement (počet obsazených slotů ze tří) a náboje. Efekty nasazených předmětů se propisují do výpočtů.

**Výsuvné panely:** zleva Spellcasting (spell sloty, připravená kouzla, detail kouzla, koncentrace), zprava Inventory (batoh, peníze, váha, nasazení a sundání předmětu, attunement). Postava bez kouzel má levý panel schovaný.

**Telefon:** sloupce se skládají pod sebe, seznam akcí je nahoře hned pod HP, výsuvné panely jsou celoobrazovkové a otevírají se ze spodní lišty.

## Chování

**Ctrl+klik na pravidla.** Ctrl+klik (na Macu Cmd+klik) na jakoukoli položku, která pochází z pravidel, otevře v nové záložce `source.url` dané položky. Při držení Ctrl se klikatelné položky zvýrazní. Na telefonu totéž udělá dlouhý stisk nebo ikona v detailu. Položka bez odkazu nabídne jeho doplnění. Výchozí odkazy pro SRD obsah navrhni (jeden vzor URL pro celý balíček, s možností přepsat u položky) a nech je schválit.

**Edit mód.** Přepínač v horní liště. V edit módu jde přepsat cokoli: spočítané hodnoty, počty použití, názvy, popisy, odkazy. Ručně přepsaná hodnota je viditelně označená a jde jedním kliknutím vrátit na spočítanou. Mimo edit mód nejde omylem nic přepsat, jen používat (odečítat zdroje, měnit HP).

**Short rest a long rest.** Tlačítko otevře dialog, který ukáže, co se obnoví, a u short restu nabídne utracení Hit Dice. Po potvrzení se vše provede podle edice. Poslední odpočinek jde vrátit zpět.

**Level up.** Průvodce krok za krokem: nejdřív volba, ve které classe postava postupuje (stávající, nebo nová, pokud splňuje požadavky na multiclass), potom přírůstek HP (průměr, nebo zadání hodu), nové featury, povinné volby (subclass, ASI nebo feat, nová kouzla, výběr ze seznamu voleb). Volby jsou zaškrtávací seznamy jen s platnými možnostmi, s počitadlem (např. „vyber 2 ze 14“), hledáním a náhledem pravidla u každé položky. Před potvrzením ukaž souhrn změn. Ukládej historii level upů, aby šel poslední vrátit.

**Tvorba postavy.** Průvodce pro vytvoření postavy od nuly: edice → class → species (v 5e race) → background → ability scores (standard array, point buy, nebo ruční zadání hodů) → skills a další proficience → výchozí vybavení nebo zlato → jméno a detaily. Kroky a jejich obsah se řídí edicí (například odkud se berou bonusy k ability scores a origin feat). Nabízí se jen obsah, který má uživatel dostupný: SRD, sdílený oficiální obsah a jeho homebrew. Postavu jde založit rovnou na vyšším levelu; průvodce pak provede jednotlivé level upy za sebou. Před uložením ukaž souhrn. Cokoli jde později změnit v edit módu.

**Zbraně na dálku a vrhací zbraně.** Vlastnosti zbraní ber z dat (ranged, thrown, finesse, ammunition, loading, range a další) a chování z nich odvoď, nic nepiš napevno pro konkrétní zbraň.

- Výpočet: útok na dálku počítá s DEX, vrhací zbraň se STR (s finesse s vyšší z obou). Bonusy z featur a předmětů (např. fighting style pro střelbu, magická zbraň) se započtou samy.
- Řádek v seznamu akcí ukazuje bonus k útoku, damage, dostřel (normální a dlouhý) a zbývající munici.
- Munice: zbraň s vlastností ammunition je napojená na munici v inventáři. Kliknutí na útok odečte jeden kus; bez munice je útok zašedlý. Když má postava víc druhů munice (např. obyčejné a magické šípy), volí se u zbraně, která se právě používá, a její bonusy se započtou.
- Po boji tlačítko „Recover ammunition“ vrátí část vystřelené munice podle pravidel edice.
- Vrhací zbraně se počítají po kusech: hod jeden odečte, tlačítko „Pick up“ je vrátí.
- Sledování munice jde v nastavení postavy vypnout, protože ho některé skupiny nehrají.
- Co appka sama nepozná (nevýhoda na dlouhý dostřel, nevýhoda při nepříteli na 5 ft, omezení vlastnosti loading na počet útoků), ukaž jako stručnou poznámku v náhledu zbraně, ne jako automatiku.
- V 5.5e ukaž u zbraně i její Weapon Mastery vlastnost, pokud ji postava umí použít.
- Střelné zbraně (firearms) fungují jako ostatní zbraně s municí. Navíc podporuj vlastnost reload (zásobník s počtem ran): u zbraně je počitadlo nabitých ran, výstřel jednu odečte a tlačítko „Reload“ zásobník doplní z munice v inventáři. Další zvláštní vlastnosti (např. burst fire, nebo misfire z homebrew pravidel) musí jít zapsat v datech jako vlastnost s poznámkou. Jestli se daný druh munice dá po boji sbírat, urči příznakem v datech munice. Ověř, které střelné zbraně jsou v SRD dané edice; ostatní patří do oficiálního obsahu mimo SRD.

**Úprava číselných hodnot.** Hodnoty, které se při hře mění (HP, temporary HP, jednotlivé mince, počty předmětů, náboje, XP), jdou upravit dvěma způsoby a oba fungují i mimo edit mód:

- Kliknutím na hodnotu ji přepíšeš přímo na nové číslo.
- Vedle hodnoty je malé pole pro číslo a u něj nad sebou tlačítka plus a minus. Napíšeš 3 a stiskneš minus („dostal jsem 3 damage“) nebo plus („získal jsem 3 GP“). Totéž udělá napsání `-3` nebo `+3` a Enter. Pole se po použití vyprázdní.

U HP dodržuj pravidla edice: damage se nejdřív odečítá z temporary HP, léčení nepřekročí maximum, hodnota neklesne pod nulu a při nule se nabídnou death saves. Peníze a počty nesmí jít do záporu; appka v tom případě upozorní a změnu neprovede. Každá změna se zapíše do game historie jako rozdíl (např. „HP −3, 38 → 35“) a jde vrátit.

**Zpět.** Běžné akce (odečtení zdroje, změna HP) mají krátkodobé undo, protože u stolu se překlikne snadno.

## Historie postavy

Každá postava má historii vedenou krok za krokem, s časem u každého záznamu. Záznamy jsou dvou druhů:

- **Game historie**: co se dělo při hře. Short a long resty, seslání kouzla a utracení spell slotu, použití schopnosti nebo zdroje, změny HP a temporary HP, stavy (conditions), začátek a konec koncentrace, použití předmětu a náboje, death saves.
- **Sheet historie**: co se změnilo na postavě samotné. Založení postavy a každý level up rozepsaný po položkách (přírůstek HP, nové featury, provedené volby, změna typu nebo počtu kostek, zesílení cantripů na vyšším levelu, nové spell sloty), ruční úpravy z edit módu (původní a nová hodnota) a úpravy pravidel nebo homebrew obsahu, které se postavy týkají. Uživatel sem může připsat i vlastní poznámku.

Zobrazení:

- Historie se otevírá tlačítkem v horní liště. Ve výchozím stavu ukazuje oba druhy dohromady, seřazené podle času od nejnovějšího.
- Každý druh jde samostatně vypnout a zapnout.
- V historii jde vyhledávat textem (název kouzla, featury, předmětu, poznámka).
- Záznamy sheet historie jsou vizuálně výraznější než záznamy game historie, aby v dlouhém seznamu nezapadly.
- Záznamy, které vznikly jednou akcí (level up, odpočinek), jsou seskupené pod jedním nadpisem a jdou rozbalit.
- Na záznamech funguje náhled pravidla a odkaz stejně jako jinde.

Technicky: záznamy ukládej do podkolekce postavy ve Firestore a načítej je po stránkách, protože game historie rychle roste. Každý záznam má čas, druh, typ události, krátký text, případně hodnotu před a po a identifikátor skupiny. Zápis do historie dělej na jednom místě v kódu, přes které procházejí všechny změny postavy; ze stejných záznamů vychází funkce zpět. Záznam se nemaže ani při vrácení akce, vrácení je nový záznam.

Navrhovaná rozšíření ke schválení: tlačítko pro označení začátku herního sezení, podle kterého se game historie rozdělí na sezení, a filtr podle typu události.

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
- Všech 12 class z Player's Handbooku v obou edicích, level 1–20. Ze SRD jsou vestavěné classy a jedna subclass ke každé; ostatní oficiální subclass, kouzla, featy, species a backgrounds přicházejí přes sdílený oficiální obsah.
- Tvorba postavy od nuly průvodcem pro všechny classy.
- Multiclass podle pravidel edice: kontrola požadavků na ability scores, proficience získané při vstupu do další classy, Hit Dice podle class, společná tabulka spell slotů pro sesílající classy a zvlášť vedené Pact Magic, pravidla pro featury, které se nesčítají (např. Extra Attack), a zdroje, které se sdílejí. Jde vypnout u postavy, protože je to volitelné pravidlo.
- Plné sesílání kouzel: spell sloty, známá a připravená kouzla podle classy a edice, Pact Magic, cantripy, rituály, koncentrace, výběr kouzel při level upu a změna připravených kouzel po odpočinku.
- Zdroje specifické pro classy (např. Rage, Focus Points, Sorcery Points, Channel Divinity, Bardic Inspiration, Wild Shape, Lay on Hands) řeš obecným mechanismem zdrojů a efektů, ne zvláštním kódem pro každou classu.
- Hlavní obrazovka, inventář, odpočinky, level up, edit mód, vzhledy, oba jazyky, editor a JSON balíčky pro homebrew.

Engine a obrazovky nejdřív postav na Fighterovi jako referenční postavě bez kouzel, sesílání na Wizardovi, a pak doplňuj ostatní classy. Přidání classy má znamenat hlavně doplnění dat. U každé classy vypiš přehled mechanik v obou edicích ke kontrole.

Mimo první verzi: sdílení postavy s DM, házení kostkami v appce. Classy mimo Player's Handbook se přidají jako obsah, pokud je uživatel zařadí mezi podporované knihy.

## Milníky

Po každém se zastav a počkej na zpětnou vazbu.

1. Kostra projektu, nasazení na GitHub Pages, přihlášení přes Google, Firestore pravidla, README s kroky nastavení.
2. Datový model, převzetí SRD dat obou edic, engine výpočtů s testy; referenční class Fighter.
3. Hlavní obrazovka jen pro čtení s ukázkovou postavou, filtry akcí, náhled pravidla při držení Ctrl a otevření klikem; nahrání sdíleného oficiálního obsahu správcem.
4. Interakce: HP, odečítání zdrojů, undo, short rest a long rest; zápis do historie a obrazovka historie s filtry a hledáním. Další milníky do historie doplňují své události.
5. Inventář, nasazené předměty, attunement, propsání efektů do výpočtů.
6. Edit mód a ruční úpravy.
7. Sesílání kouzel a panel Spellcasting; referenční class Wizard, potom ostatní sesílající classy včetně Pact Magic.
8. Zbývající classy a jejich zdroje v obou edicích.
9. Level up pro všechny classy včetně multiclassu.
10. Tvorba postavy od nuly.
11. Oficiální obsah mimo SRD: balíčky po knihách v pořadí odsouhlaseném s uživatelem.
12. Editor homebrew obsahu, import a export JSON balíčků, dokumentace formátu.
13. Vzhledy a přepínání jazyků.
14. Doladění na telefonu.

Před milníkem 1 si přečti celé zadání, sepiš otázky a nejasnosti a navrhni strukturu projektu. Začni, až bude návrh odsouhlasený.

