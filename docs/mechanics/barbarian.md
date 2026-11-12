# Barbarian: mechaniky ke kontrole

Ověřeno proti SRD 5.1 (2014) a SRD 5.2.1 (2024). Počty Rage, Rage Damage, Brutal Critical a Weapon Mastery se při sestavení dat porovnávají s tabulkou classy.

**Automaticky** = appka spočítá / odečte sama. **Stav** = akce zapne přepínač (čip ⚡ pod HP, vypneš ho klikem; odpočinek ho ukončí). **Poznámka** = jen připomínka.

## Barbarian

| Schopnost | 5e (2014) | 5.5e (2024) | Jak to appka řeší |
| --- | --- | --- | --- |
| Rage | Bonus action, 2/3/4/5/6 použití (1/3/6/12/17), na 20. neomezeně; vrací long rest | Bonus Action, 2/3/4/5/6; short rest vrátí 1, long rest všechny | Automaticky: akce utratí použití a zapne stav **Raging**. Na 20. levelu 2014 ukazuje 99 použití. |
| Rage Damage | +2/+3/+4 (1/9/16) k melee útokům zbraní se Strength | Totéž k útokům se Strength (zbraň i Unarmed Strike, i hozená zbraň) | Automaticky, jen když je Raging |
| Resistance B/P/S, advantage na Str checky a savy, žádná kouzla | ano | ano | Poznámka během Raging |
| Unarmored Defense | 10 + Dex + Con, štít smí | Totéž | Automaticky |
| Reckless Attack | Advantage na Str melee útoky, útoky na tebe s advantage | Totéž (Str útoky) | Stav **Reckless** s poznámkou |
| Danger Sense, Feral Instinct | Advantage na Dex savy / initiative | Totéž | Popis (Ctrl) |
| Weapon Mastery | — | 2/3/4 zbraně (1/4/10) | Automaticky |
| Primal Knowledge | — | Další dovednost; v Rage jdou Acrobatics, Intimidation, Perception, Stealth, Survival přes Str | Volba dovednosti + poznámka v Rage |
| Extra Attack | 5. level | 5. level | Automaticky |
| Fast Movement | +10 ft bez těžké zbroje | Totéž | Automaticky |
| Brutal Critical | +1/2/3 kostky zbraně při kritu (9/13/17) | — | Popis |
| Brutal Strike | — | Reckless: vzdát se advantage → +1d10 (2d10 od 17.) a efekt | Akce s kostkou, 1× za tah |
| Relentless Rage | DC 10 Con, +5 za každé použití | Totéž, HP = 2× level | Automaticky: DC 10, každé použití +5, short / long rest vrátí na 10; použití vyléčí na 1 HP (2024: 2× level) |
| Persistent Rage | Rage končí jen bezvědomím | Při initiative vrátí všechny Rage (1× za long rest), Rage 10 minut | 2024: akce vrátí všechny Rage automaticky |
| Indomitable Might | Str check pod Str skóre → použij skóre | Totéž i pro Str save | Popis |
| Primal Champion | Str a Con +4, max 24 | +4, max 25 | Automaticky |

## Path of the Berserker

| Schopnost | 5e (2014) | 5.5e (2024) | Jak to appka řeší |
| --- | --- | --- | --- |
| Frenzy | Při Rage: bonus action útok každý tah, po skončení 1 exhaustion | Raging + Reckless: první zásah za tah +Xd6 (X = Rage Damage) | 2014: stav **Frenzied**, skončí s Rage a přidá 1 exhaustion automaticky. 2024: akce s kostkami, 1× za tah |
| Mindless Rage | Nejde zastrašit ani okouzlit během Rage | Immunity na Charmed a Frightened během Rage | Poznámka během Raging |
| Intimidating Presence | Action, jeden tvor, Wis save DC 8 + PB + Cha | Bonus Action, 30 ft, DC 8 + Str + PB, 1× za long rest (nebo za Rage) | Akce s DC; 2024 obnova za Rage jako akce |
| Retaliation | Reaction: melee útok na toho, kdo tě zranil do 5 ft | Totéž | Akce (reakce) |
