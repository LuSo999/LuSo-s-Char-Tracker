# Export do character sheetu (PDF)

Tlačítko **📄 PDF** na sheetu postavy (na telefonu v menu ⋯) vyplní libovolný character sheet v PDF.

- **Šablona** říká, kam co patří. Vestavěné: oficiální D&D 2024 sheet (vyplňovací PDF od WotC) a Ten-Foot Pole Gunslinger (A4). Vlastní šablony se ukládají k účtu (`users/{uid}/sheetTemplates`).
- **PDF** se nahraje jednou a zůstane jen v prohlížeči (IndexedDB, podle otisku souboru). Do repa ani do databáze se nedává.
- **Nový sheet z PDF:** appka přečte formulářová pole a vytištěné popisky (pdf.js) a navrhne, co kam patří (`src/engine/export/analyze.ts`): dovednosti podle názvu vedle pole, bloky vlastností (Modifier / Score pod nadpisem vlastnosti), záchranné hody, tabulky útoků a kouzel podle záhlaví sloupců, pole s popiskem pod / nad / vedle. Co nepozná, doplníš v editoru.
- **Sheet bez formulářových polí** (jen grafika): v editoru tažením nakreslíš rámeček textu, klepnutím tečku (kolečko proficience). Když PDF nemá ani čitelný text (popisky jako obrázek), analýza nic nenajde a všechno se rozmístí ručně.
- **Vyplnění** (`src/engine/export/fill.ts`, pdf-lib): text se zalomí a zmenší, aby se vešel; vkládá se font Roboto, takže fungují česká písmena. Formulářová pole zůstanou editovatelná.
- **Co se vyplní:** viz katalog v `src/engine/export/values.ts` (identita, vlastnosti, záchrany, skills, boj, útoky, spellcasting a kouzla, featury, proficience, vybavení, mince, attunement).
