# Obrázky pro vzhledy (themes) – zadání pro Gemini

Tento soubor popisuje, jaké obrázky appka potřebuje pro každý vzhled a jak je pojmenovat. Prompty jsou anglicky, protože na ně generátory obrázků reagují spolehlivěji.

## Co vygenerovat

Pro každý vzhled dva obrázky, třetí je volitelný:

| Soubor | Poměr stran | K čemu slouží |
| --- | --- | --- |
| `background.png` | 16:9, co největší rozlišení | Pozadí celé appky na PC |
| `texture.png` | 1:1 | Jemná textura karet a výsuvných panelů |
| `background-mobile.png` (volitelné) | 9:16 | Pozadí na telefonu; bez něj se použije výřez z `background.png` |

Vzhledy `light` a `dark` obrázky nemají, jsou to čisté barevné režimy.

Celkem tedy 16 povinných obrázků (8 vzhledů × 2) a až 8 volitelných.

## Kam je uložit

```
theme-images/
  scroll/
    background.png
    texture.png
    background-mobile.png
  arcane/
  divine/
  battlefield/
  forest/
  music/
  kraken/
  pirate-ship/
```

Názvy složek a souborů dodrž přesně, Claude Code podle nich obrázky napojí na vzhledy a převede je do WebP.

## Pravidla pro všechny obrázky

- Na pozadí leží karty s textem, takže střed obrázku musí být klidný. Výrazné motivy patří do rohů a k okrajům.
- Žádný text, písmena, číslice, loga ani rámečky připomínající UI.
- Žádné postavy v popředí ani obličeje.
- Nízký kontrast a málo drobných detailů, aby pozadí nerušilo čtení.
- Stejný malířský styl napříč všemi vzhledy, aby appka působila jednotně.
- Textura má být rovnoměrná, bez výrazného motivu a bez viditelného středu, aby se dala opakovat vedle sebe.

## Společné části promptů

Na začátek každého promptu pro pozadí vlož:

```
Digital painting, fantasy tabletop RPG atmosphere, soft painterly brushwork, muted low-contrast palette, wide establishing composition. The central 60% of the image is calm, dark-toned or evenly toned empty space with almost no detail, because user interface panels will be placed on top of it. All distinctive elements sit in the corners and along the edges. No text, no letters, no numbers, no logos, no frames, no people, no faces. 16:9 aspect ratio.
```

Pro mobilní verzi použij stejný prompt a nahraď poslední větu za `9:16 portrait aspect ratio, distinctive elements at the top and bottom edges.`

Na začátek každého promptu pro texturu vlož:

```
Seamless tileable texture, flat even lighting, top-down view, uniform density across the whole image, no focal point, no vignette, no text, no symbols, very subtle low-contrast detail. 1:1 aspect ratio.
```

## Prompty pro jednotlivé vzhledy

### scroll (světlý)

Barvy: pergamen `#E9DDC3`, inkoust `#3B2A1A`, sépie `#7A3B12`.

Pozadí:
```
An old wizard's writing desk seen from above, covered by a large blank sheet of aged parchment that fills the center. In the corners: a quill and inkwell, a wax seal, rolled scrolls, a brass compass, faint ink stains. Warm candlelight, sepia and cream tones.
```

Textura:
```
Aged parchment paper, cream and light tan, faint fibers and soft stains.
```

### arcane (tmavý)

Barvy: indigo `#17132B`, fialová `#7F77DD`, levandulová `#CECBF6`.

Pozadí:
```
A dark arcane sanctum at night. Deep indigo and violet void in the center. Around the edges: faintly glowing abstract magic circles made of geometric lines, drifting motes of violet light, floating crystals, a hint of constellations. Mysterious, quiet, softly luminous.
```

Textura:
```
Dark indigo velvet-like surface with barely visible star dust and faint violet geometric line fragments.
```

### divine (světlý)

Barvy: slonovina `#F7F1DF`, zlatá `#BA7517`, tmavě zlatá `#854F0B`.

Pozadí:
```
Interior of a bright celestial temple. Soft ivory haze in the center. Along the edges: white marble columns, gold filigree ornaments, sunbeams falling through high windows, a few floating feathers. Serene, radiant, ivory and warm gold tones.
```

Textura:
```
Polished ivory marble with very faint warm gold veins.
```

### battlefield (tmavý)

Barvy: uhel `#24201D`, žhavá oranžová `#D85A30`, popel `#B9A99A`.

Pozadí:
```
A battlefield at dusk after the fighting has ended. Dark smoke and ash haze in the center. Along the edges: torn banners on broken poles, swords and spears stuck in the ground, a dented shield, glowing embers drifting through the air, a dull orange horizon. Grim, charcoal and ember tones.
```

Textura:
```
Dark scratched forged steel plate with subtle soot and faint ember-colored scuffs.
```

### forest (tmavý)

Barvy: tmavá zeleň `#14241B`, mechová `#639922`, světlá zeleň `#C0DD97`.

Pozadí:
```
A deep ancient forest in twilight. Dark green mist in the center. Along the edges: massive mossy tree trunks, hanging vines, ferns, glowing mushrooms, a few fireflies, thin shafts of pale light. Calm, enchanted, deep green tones.
```

Textura:
```
Dark green moss and tiny leaves, soft and even.
```

### music (tmavý)

Barvy: vínová `#2A1420`, růžová `#D4537E`, světle růžová `#F4C0D1`.

Pozadí:
```
A bard's corner of a cozy tavern at night. Dark burgundy shadow in the center. Along the edges: a lute leaning on a chair, a wooden flute, a small drum, warm lantern glow, abstract flowing ribbons of light suggesting melody drifting through the air. Warm, intimate, burgundy and rose tones.
```

Textura:
```
Dark burgundy stage curtain fabric with soft even folds.
```

### kraken (tmavý)

Barvy: hlubinná `#0B1F2A`, tyrkysová `#1D9E75`, světle tyrkysová `#9FE1CB`.

Pozadí:
```
The deep ocean abyss. Dark teal-black water in the center. From the corners and edges: huge kraken tentacles with suckers curling inward, drifting bioluminescent particles, faint light rays from far above, the silhouette of a sunken anchor. Ominous, vast, deep teal and ink tones.
```

Textura:
```
Dark teal wet leathery skin with a subtle pattern of small scales and faint bioluminescent specks.
```

### pirate-ship (tmavý)

Barvy: tmavé dřevo `#2B1E14`, mosaz `#BA7517`, plachtovina `#E9DDC3`.

Pozadí:
```
The deck of a pirate ship at night seen from above the helm. Dark weathered deck planks in the center. Along the edges: coiled ropes, a ship's wheel, a brass lantern casting warm light, a barrel, the edge of a furled canvas sail, dark sea and a few stars beyond the railing. Adventurous, warm lantern light against deep navy night.
```

Textura:
```
Dark weathered ship deck planks, tightly fitted, with subtle wood grain and worn edges.
```

## Kontrola před předáním

- Text ve světlých vzhledech bude tmavý, v tmavých světlý. Pokud je střed pozadí u tmavého vzhledu moc světlý (nebo naopak), vygeneruj obrázek znovu.
- Zkus si přes obrázek představit bílou nebo tmavou kartu s textem. Pokud motiv pod ní ruší, je moc výrazný.
- Polož si texturu čtyřikrát vedle sebe. Pokud jsou vidět švy nebo se opakuje výrazná skvrna, vygeneruj ji znovu.
