# Vzhledy (themes)

Každý vzhled je složka v `src/themes/<id>/`:

- `theme.json`: název, `mode` (`light` / `dark`), barvy (`bg`, `card`, `text`, `muted`, `accent`, `accentText`, `border`, `danger`), `cardOpacity` (jak moc barva karty kryje texturu, výchozí 0.88), volitelně `radius` (zaoblení karet) a `fontHeading` (font nadpisů, CSS font-family; musí být načtený, např. z Google Fonts v `index.html`).
- `background.webp`: pozadí pod celou appkou (16:9, kolem 1920 px). Nepovinné.
- `texture.webp`: textura karet a panelů (čtverec, kolem 512 px, opakuje se). Nepovinná.
- `frame.svg` a `corners.svg`: zdobené rámečky (zapínají se zaškrtávátkem pod výběrem vzhledu). SVG 120×120 rozdělené na 9 dílů po 40: `frame.svg` kreslí okraje (horní díl x 40–80, opakuje se), `corners.svg` rohy (díl 0–40, zobrazí se větší a trochu přesahují). Nepovinné. Rámečky stávajících vzhledů generuje `python3 scripts/theme-frames.py src/themes` z barev v `theme.json`.

Nový vzhled = nová složka, nic dalšího se neupravuje. Appka ho sama najde, nabídne v Nastavení i na sheetu (🎨) a obrázky načte až při jeho výběru. Test `src/themes/themes.test.ts` zkontroluje, že barvy splňují kontrast WCAG AA (text na kartách aspoň 7:1, ostatní aspoň 4,5:1).

Převod obrázku: `cwebp -q 72 -resize 1920 0 background.png -o background.webp`, `cwebp -q 75 -resize 512 512 texture.png -o texture.webp`.

Vzhled se ukládá k účtu (výchozí pro všechny postavy) a každá postava ho může přepsat vlastním.

Fonty jsou pro všechny vzhledy stejné: Roboto Condensed na nadpisy a Roboto na text, jako na character sheetu D&D Beyond.
