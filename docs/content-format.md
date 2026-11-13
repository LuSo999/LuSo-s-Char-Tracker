# Formát obsahu (balíčky)

Pravidla v appce (SRD, oficiální knihy i tvůj homebrew) jsou **balíčky** (packs) ve stejném JSON formátu. Homebrew se vytváří v appce (🧪 Homebrew v seznamu postav) a sdílí se exportem a importem tohoto souboru. Přesné schéma je v [`src/content/schema.ts`](../src/content/schema.ts) (zod). Při importu a uložení se proti němu kontroluje a chyby se vypíšou s cestou k problematickému poli.

Úplný příklad: [`docs/samples/homebrew-example.json`](samples/homebrew-example.json). Je to vymyšlená subclass Fightera „Lantern Warden“ se zásobou kostek, volitelnými technikami a akcemi, které kostky utrácejí, plus štít s náboji, který sesílá kouzlo.

## Balíček

```json
{
  "id": "hb-muj-balicek",
  "name": "Můj homebrew",
  "edition": "2024",
  "version": "1",
  "book": "homebrew:hb-muj-balicek",
  "entities": [ … ]
}
```

- `edition`: `"2014"` (5e) nebo `"2024"` (5.5e). Balíček je dostupný postavám své edice.
- `book`: u homebrew vždy `homebrew:<id>`. Takový obsah je u postav vždy povolený.
- Pozdější balíček vyhrává při shodě `id`, takže homebrew může záměrně nahradit entitu ze SRD.

## Entita (společná pole)

| Pole | Význam |
| --- | --- |
| `id` | Unikátní id (malá písmena, pomlčky). Odkazy mezi entitami jdou přes id. |
| `type` | `feature`, `trait`, `subclass`, `class`, `feat`, `species`, `subspecies`, `background`, `item`, `spell` |
| `edition`, `name` | Edice a název |
| `description` | Krátké shrnutí (ukazuje se v seznamech a po Ctrl+najetí) |
| `source` | `{ "book": "…", "url": "…" }`, url je nepovinná |
| `resources` | Zdroje (použití, zásoby kostek) |
| `activities` | Akce v seznamu akcí |
| `effects` | Bonusy a změny čísel na sheetu |
| `choices` | Volby, které hráč udělá (skills, možnosti, kouzla…) |
| `spells` | Kouzla, která entita dává (vždy připravená) |
| `attacks` | Útoky mimo předměty (drápy, rohy, vyvolaná zbraň) |
| `replaces` | Id featur, které tahle nahrazuje |
| `tags` | Štítky (např. kategorie featu) |

### Zdroj (`resources`)

```json
{ "id": "lantern-dice", "name": "Lantern Dice",
  "max": { "byLevel": { "3": 4, "7": 5, "15": 6 } },
  "die": { "byLevel": { "3": 6, "10": 8 } },
  "recharge": [{ "on": "shortRest", "amount": "all" }, { "on": "longRest", "amount": "all" }] }
```

- `max` a `die` jsou **Scaled**: číslo, vzorec (`"pb"`, `"cha"`, `"2 * level"`, `"max(1, wis)"`) nebo `{ "byLevel": {…} }` podle levelu classy (`"per": "characterLevel"` = podle levelu postavy).
- `recharge.on`: `shortRest`, `longRest`, `dawn`, `turnStart`. `amount`: `"all"`, číslo, nebo `dice` hozený hráčem (`"1d6+1"`).
- `resetWith: "Raging"`: zdroj se obnoví, když skončí stav (jednou za Rage).
- `hidden: true`: pomocné počítadlo, které se nezobrazuje.
- Id zdrojů jsou sdílená po celé postavě: akce s `cost: [{ "resource": "channel-divinity" }]` čerpá z Channel Divinity classy. Další sdílené zdroje: `bardic-inspiration`, `rage`, `wild-shape`, `focus` (5.5e) / `ki` (5e), `sorcery-points`, `superiority-dice`.

### Akce (`activities`)

```json
{ "id": "use", "name": "Flare", "actionType": "other", "attack": true, "perTurn": 1,
  "cost": [{ "resource": "lantern-dice" }],
  "roll": { "dice": { "count": 1, "die": "die_lantern_dice" }, "kind": "damage" },
  "saveDc": "8 + pb + wis", "saveAbility": "con",
  "summary": "Hit: +1 Lantern Die Radiant; Con save or Blinded." }
```

| Pole | Význam |
| --- | --- |
| `actionType` | `action`, `bonusAction`, `reaction`, `other` |
| `cost` | Co utrácí. `@quantity` = sám předmět (lektvar), `@hitDie` = jedna Hit Point Die |
| `roll` | `dice` (`"2d6"` nebo `{count, die}`), `bonus` (Scaled), `kind`: `damage`, `heal`, `temp`, `other` |
| `saveDc`, `saveAbility` | DC záchrany a vlastnost |
| `spendInput` | Hráč zadá, kolik bodů utratí (Lay on Hands); s `spendDice: 6` jde o kostky, které hodí a sečte |
| `restore` | Vrátí jiný zdroj: `[{ "resource": "lantern-dice", "amount": 1 }]` |
| `slotCost`, `slotMin`, `restorePerSlotLevel` | Utratí spell slot (nejméně dané úrovně), případně tím doplní zdroj |
| `toggle` | Zapne stav (`"Raging"`). Efekty s `when: { toggle }` pak platí. Rest stav ukončí. |
| `attack`, `perTurn`, `perAttack`, `costsAttack` | Efekt při zásahu, limit za tah / za útok, nahrazuje útok |
| `minLevel` | Od levelu postavy |

Ve vzorcích akcí fungují: `pb`, `level`, `characterLevel`, `str`…`cha` (modifikátory), `strScore`…, skills (`athletics`), `hpMax`, `attuned`, `used_<zdroj>`, `max_<zdroj>`, `die_<zdroj>` (velikost kostky zásoby) a `mod_<id volby>` (modifikátor vlastnosti vybrané ve volbě).

### Efekty (`effects`)

```json
{ "target": "ac", "op": "add", "value": 1, "when": "wearingArmor" }
```

Cíle (`target`):
- **Obrana a pohyb:** `ac`, `unarmoredAc:<vzorec>`, `speed`, `speed:fly|swim|climb|burrow` (hodnota `"walk"`, `"walk * 2"`), `reach`.
- **Útoky:** `attack`, `damage`, `critRange`, `attacksPerAction` (op `max`), `attackAbility:<vlastnost>`, `monkWeapon:<zbraň>`, `unarmedDamage` (kostka).
- **Postava:** `hpMax`, `hpPerLevel`, `initiative`, `score:<vlastnost>` (`max` = strop), `save:<vlastnost>`, `save:all`, `check:<vlastnost>`, `check:all`, `skill:<skill>`, `passive:<skill>`.
- **Proficience:** `proficiency:skill|save|armor|weapon|tool|language:<id>` (hodnota 2 = expertise).
- **Smysly a odolnosti:** `sense:darkvision` (op `max`, nebo `add` pro rozšíření), `resistance:<typ>`, `immunity:<typ>`, `conditionImmunity:<stav>`.
- **Kouzla:** `spellDc`, `spellAttack`, `spellDc:<classa>`, `spellDamage:<kouzlo>`, `spellNote:<kouzlo>`.
- **Připomínky:** `note` (text v `note`), `advantage:save:condition` (poznámka u záchran).
- **Wild Shape:** `shape:maxCr` (nejvyšší CR formy, op `max`), `shape:fly` / `shape:swim` (1 = formy s létáním / plaváním povolené), `shape:forms` (2024: počet známých forem), `shape:ac` (AC ve formě, op `max`, např. Circle of the Moon `"13 + wis"`).

`op`: `add` (výchozí), `set`, `max`, `min`. Do cíle jde vložit `@<id volby>`, které se nahradí každou vybranou hodnotou, např. `resistance:@types`.

`when` (jedna podmínka, nebo pole = všechny musí platit):
- **Zbroj a štít:** `wearingArmor`, `wearingHeavyArmor`, `wearingMediumArmor`, `noArmor`, `noShield`, `wieldingShield`, `noArmorNoShield`, `notHeavyArmor`, `noMediumOrHeavyArmor`.
- **Zbraně a útoky:** `meleeWeapon`, `rangedWeapon`, `weaponAttack`, `heavyWeapon`, `thrownWeapon`, `magicWeapon`, `strengthAttack`, `martialArts`, `emptyHands`.
- **Ostatní:** `bloodied`, `notProficient`, `{ "toggle": "Název" }`.

### Volby (`choices`)

```json
{ "id": "techniques", "label": "Lantern Techniques", "kind": "entity",
  "count": { "byLevel": { "3": 2, "7": 3 } },
  "from": { "ids": ["hb-example-flare", "hb-example-ward"] }, "changeable": "levelUp" }
```

- `kind`:
  - `entity`: možnosti z `from.ids`, nebo `from.type` + `from.tags`
  - `skill`: `expertise: true` = expertise
  - `ability`, `abilityPoints`: `points`, `perOption`, `scoreCap`
  - `spell`: `spellLevel`, `spellClasses`, `spellSchools`, `ritualOnly`, `knownOnly`
  - `option`, `language`, `tool`, `weaponMastery`
- `changeable`: `never`, `levelUp`, `shortRest`, `longRest`
- Možnost jiné volby (manévr, invocation) má `optionOf: "<id vlastníka volby>"`. Nabídne se v jeho volbě, i když je z jiného balíčku.
- Volba s id `size` (`kind: option`, `options: ["Medium", "Small"]`) na rase nastaví velikost.

### Kouzla od entity (`spells`)

```json
{ "id": "faerie-fire", "freeCast": "charges", "minLevel": 3, "abilityFromChoice": "ability" }
```

Další pole:
- `fromChoice`: kouzla vybraná ve volbě
- `atWill`: kdykoli
- `freeCast`, `freeCost`: zdarma za zdroj, případně víc nábojů
- `freeOnly`: jen zdarma
- `ritualOnly`: jen jako rituál
- `freeLevel`: úroveň seslání zdarma
- `limit`: kromě slotu utratí ještě tento zdroj

Kouzla z předmětů jdou vždy jen zdarma z nábojů předmětu.

### Útoky (`attacks`)

```json
{ "id": "claws", "name": "Claws", "damage": { "dice": "1d6", "type": "slashing" },
  "properties": ["finesse"], "diceByLevel": { "11": "1d8" }, "while": "Raging" }
```

### Společníci (`companions`, u featury, kouzla nebo předmětu)

```json
{ "id": "steed", "kind": "steed", "creatures": ["creature-otherworldly-steed"], "slot": true, "note": "…" }
```

`kind`: `familiar`, `steed`, `companion` (od každého zdroje jen jeden naráz), `summon` (víc naráz). Tvory určuje seznam `creatures` (id) a/nebo `filter: { creatureType, maxCr, tag }`. `slot: true` = stat block škáluje s úrovní kouzla. `spellClass` = jejíž spell attack / DC tvor používá.

### Podmínky (`prerequisite`, u featu, možnosti nebo subclassy)

`level`, `abilities: [{ ability, min }]`, `features` (musí mít), `spells` (zná aspoň jedno), `species`, `anyTag` / `noTag`, `weaponProficiency`, `anyOf: [ … ]` (stačí jedna alternativa) a `text` (ukáže se k ověření).

## Typy

- **feature / trait:** `actionType` (pro řazení), `parent`, `optionOf`, `upgradeOf`.
- **subclass:** `class` (id classy), `levels: [{ "level": 3, "features": ["…"] }]`. Kouzlící subclassa (jako Eldritch Knight) má navíc `spellcasting: "third"`, `caster`, `spellTable`.
- **feat:** `category` (2024: `origin`, `general`, `fighting-style`, `epic-boon`; dej ho i do `tags`), `prerequisite`, `repeatable`.
- **species / subspecies:**
  - species: `size`, `speed`, `traits` (id traitů), `languages`, `abilityBonuses` (2014), `subspecies`
  - subspecies: `species` (id rasy)
- **background:**
  - `skills`, `tools`, `features`
  - 2024 navíc: `abilityOptions` (3 vlastnosti), `feat`, `featPresets`
  - vybavení: `startingItems`, `startingGold`, `startingEquipment`
- **item:**
  - `kind`: `weapon`, `armor`, `wondrous`, `ring`, `rod`, `staff`, `wand`, `potion`, `scroll`, `gear`, `ammunition`, `tool`, `pack`
  - společná pole: `magic`, `rarity`, `attunement`, `charges`, `consumable`, `weight`, `cost`
  - weapon: `category`, `range`, `damage`, `properties`, `distance`, `mastery`
  - armor: `category`, `ac: { base, dex, maxDex }`, `strMin`, `stealthDisadvantage`
  - tag `unarmed` přenese bonusy předmětu na útok beze zbraně
- **creature (stat block):** `size`, `creatureType`, `cr`, `ac`, `hp`, `hitDice`, `speed: { walk, fly, swim, climb, burrow }`, `scores`, `saves`, `skills`, `senses`, `passivePerception`, `languages`, `resistances`, `immunities`, `conditionImmunities`, `traits: [{ name, description }]`, `actions: [{ name, actionType, description, attack: { bonus, range }, damage: [{ dice, bonus, type }], save: { ability, dc } }]`.
  - Čísla můžou být vzorce: `slot` (úroveň kouzla), `spellAttack`, `spellDc`, `pb`, `level` (úroveň classy zdroje), `wis` a další modifikátory majitele. Např. `"ac": "10 + slot"`, `"hp": "5 + 10 * slot"`.
- **spell:** `level`, `school`, `castingTime`, `actionType`, `range`, `components`, `material`, `duration`, `concentration`, `ritual`, `classes`, `attack`, `save`, `damage: { type, by: "slot"|"character", dice: { "1": "3d6" } }`, `heal`, `higherLevels`, `brief`.

## Kontrola

Editor u balíčku ukáže odkazy, které neexistují (feature v levelech subclassy, možnosti voleb, kouzla, rasa podrasy). Při ukládání se každá položka kontroluje proti schématu.
