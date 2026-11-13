# Vzhledy (themes)

Každý vzhled je složka v `src/themes/<id>/`:

- `theme.json`: název, `mode` (`light` / `dark`), barvy (`bg`, `card`, `text`, `muted`, `accent`, `accentText`, `border`, `danger`), `cardOpacity` (jak moc barva karty kryje texturu, výchozí 0.88), volitelně `radius`.
- `background.webp`: pozadí pod celou appkou (16:9, kolem 1920 px). Nepovinné.
- `texture.webp`: textura karet a panelů (čtverec, kolem 512 px, opakuje se). Nepovinná.

Nový vzhled = nová složka, nic dalšího se neupravuje. Appka ho sama najde, nabídne v Nastavení i na sheetu (🎨) a obrázky načte až při jeho výběru. Test `src/themes/themes.test.ts` zkontroluje, že barvy splňují kontrast WCAG AA (text na kartách aspoň 7:1, ostatní aspoň 4,5:1).

Převod obrázku: `cwebp -q 72 -resize 1920 0 background.png -o background.webp`, `cwebp -q 75 -resize 512 512 texture.png -o texture.webp`.

Vzhled se ukládá k účtu (výchozí pro všechny postavy) a každá postava ho může přepsat vlastním.

Fonty jsou pro všechny vzhledy stejné: Roboto Condensed na nadpisy a Roboto na text, jako na character sheetu D&D Beyond.
