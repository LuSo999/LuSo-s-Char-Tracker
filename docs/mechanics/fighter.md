# Fighter: mechaniky ke kontrole

Přehled toho, co appka u Fightera a subclass Champion počítá sama. Každou položku jsem ověřil proti textu SRD 5.1 (2014) nebo SRD 5.2.1 (2024). Počty z tabulek class jsou navíc při sestavení dat automaticky porovnané se zdrojovými daty.

**Automaticky** znamená, že appka hodnotu sama spočítá nebo odečte. **Poznámka** znamená, že se pravidlo jen zobrazí, protože ho appka nemůže vyhodnotit sama (záleží na situaci u stolu).

## Fighter

| Schopnost | 5e (2014) | 5.5e (2024) | Jak to appka řeší |
| --- | --- | --- | --- |
| Hit Die | d10 | d10 | Automaticky (HP, Hit Dice) |
| Saving throws | Str, Con | Str, Con | Automaticky |
| Fighting Style | Volba ze 6 stylů (featura) | Fighting Style feat (v SRD Archery, Defense, Great Weapon Fighting, Two-Weapon Fighting), jde vyměnit při level upu | Archery +2 k útoku na dálku a Defense +1 AC ve zbroji jsou automatické. Dueling (2014) +2 k damage má přepínač „podmínka platí“. Ostatní jsou poznámky. |
| Second Wind | Bonus action, 1d10 + level, 1 použití, obnova při short i long restu | Bonus action, 1d10 + level, 2/3/4 použití (level 1/4/10), short rest vrátí 1, long rest všechna | Automaticky |
| Weapon Mastery | — | 3/4/5/6 zbraní (level 1/4/10/16), jednu jde vyměnit po long restu | Automaticky (vlastnost se ukáže u zbraně) |
| Action Surge | 1 použití, od 17. levelu 2, short nebo long rest | Totéž, navíc „ne Magic action“ | Automaticky |
| Tactical Mind | — | Při neúspěšném ability checku utratí Second Wind a přidá 1d10. Když hod i tak selže, použití se nevrátí z appky samo. | Akce čerpá z Second Wind. Vrácení při neúspěchu zatím udělá hráč tlačítkem zpět. |
| Ability Score Improvement | +2 / +1 +1, max 20 (4, 6, 8, 12, 14, 16, 19) | Feat; v SRD Ability Score Improvement nebo Grappler (4, 6, 8, 12, 14, 16) | Automaticky |
| Extra Attack | 2 útoky od 5., 3 od 11., 4 od 20. | Totéž | Automaticky (počet útoků v akci) |
| Tactical Shift | — | Second Wind + pohyb o polovinu rychlosti bez opportunity attacks | Poznámka |
| Indomitable | Přehoz saving throw, 1/2/3 použití (9/13/17), long rest | Totéž, navíc bonus rovný levelu Fightera | Automaticky |
| Tactical Master | — | U zbraně s mastery jde vlastnost nahradit Push, Sap nebo Slow | Poznámka |
| Studied Attacks | — | Po minutí advantage na další útok proti stejnému cíli | Poznámka |
| Epic Boon | — | Epic Boon feat na 19. levelu, +1 k vlastnosti (max 30) | Automaticky |

## Champion

| Schopnost | 5e (2014) | 5.5e (2024) | Jak to appka řeší |
| --- | --- | --- | --- |
| Improved Critical | Kritický zásah na 19–20 (level 3) | Totéž, i pro Unarmed Strike | Automaticky |
| Remarkable Athlete | Level 7: polovina PB (zaokrouhleno nahoru) k checkům na Str, Dex a Con bez proficience, včetně iniciativy | Level 3: advantage na iniciativu a Athletics, po kritickém zásahu pohyb o polovinu rychlosti | 2014 automaticky, 2024 poznámka |
| Additional Fighting Style | Level 10 | Level 7 | Automaticky (volba) |
| Heroic Warrior | — | Level 10: Heroic Inspiration na začátku tahu | Poznámka |
| Superior Critical | Kritický zásah na 18–20 (level 15) | Totéž | Automaticky |
| Survivor | Level 18: na začátku tahu 5 + Con HP, pokud máš nejvýš polovinu HP | Level 18: advantage na death saves, 18–20 počítá jako 20; na začátku tahu 5 + Con HP, pokud jsi Bloodied | Poznámka (automatické léčení přijde s ekonomikou tahu) |

## Obecná pravidla, která se liší podle edice

| Pravidlo | 5e (2014) | 5.5e (2024) |
| --- | --- | --- |
| Long rest a Hit Dice | Vrátí polovinu celkového počtu (nejméně 1) | Vrátí všechny |
| Temporary HP | Zmizí po long restu | Zmizí po long restu |
| Exhaustion | 6 úrovní: 1 nevýhoda na checky, 2 poloviční rychlost, 3 nevýhoda na útoky a saves, 4 poloviční max. HP, 5 rychlost 0, 6 smrt | Každá úroveň −2 ke všem hodům d20 a −5 ft rychlosti, na úrovni 6 smrt |
| Potion of Healing | Action | Bonus Action (platí pro všechny lektvary) |
| Sbírání munice po boji | Polovina | Polovina (zaokrouhleno dolů), platí i pro náboje do střelných zbraní |
| Těžká zbroj bez potřebné Strength | −10 ft rychlosti | −10 ft rychlosti |
