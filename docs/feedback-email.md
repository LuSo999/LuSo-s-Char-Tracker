# E-mail o nové zpětné vazbě (Google Apps Script)

Zpětná vazba se ukládá do Firestore (`feedback`) a správce ji vidí pod 💡 v hlavičce. Aby přišel i e-mail, appka po uložení pošle zprávu malému skriptu v Google Apps Script. Ten běží zdarma pod tvým Google účtem a pošle mail z tvého Gmailu na tvou adresu.

## Nastavení (jednou, asi 2 minuty)

1. Otevři <https://script.google.com> → **Nový projekt** (New project). Pojmenuj ho třeba „Char Tracker – zpětná vazba“.
2. Smaž obsah souboru `Code.gs` a vlož tam kód níže. Ulož (Ctrl+S).
3. Vpravo nahoře **Nasadit → Nové nasazení** (Deploy → New deployment).
   - Typ (ozubené kolečko): **Webová aplikace** (Web app).
   - **Spustit jako:** Já (Me).
   - **Kdo má přístup:** Kdokoli (Anyone). Appka posílá zprávu bez přihlášení ke Googlu.
4. Klikni na **Nasadit**, povol přístup (Google se zeptá na oprávnění posílat maily – potvrď, i přes hlášku „aplikace není ověřená“: *Rozšířené → Přejít na projekt*).
5. Zkopíruj **URL webové aplikace** (končí `/exec`).
6. V Char Trackeru klikni na 💡 → dole **Upozornění e-mailem** → vlož URL → **Uložit**.
7. Vyzkoušej: 💬 → pošli testovací zprávu. Mail by měl přijít do minuty.

Při úpravě kódu je potřeba **Nasadit → Spravovat nasazení → upravit → Verze: nová verze**, jinak URL dál spouští starý kód.

## Kód (`Code.gs`)

```js
// Char Tracker: pošle e-mail o nové zpětné vazbě. Nejvýš 30 mailů za hodinu.
const MAX_PER_HOUR = 30

function doPost(e) {
  const cache = CacheService.getScriptCache()
  const hour = 'count-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH')
  const count = Number(cache.get(hour) || 0)
  if (count >= MAX_PER_HOUR) return ContentService.createTextOutput('rate limited')
  cache.put(hour, String(count + 1), 3600)

  const d = JSON.parse(e.postData.contents)
  const kinds = { bug: '🐞 Chyba', idea: '💡 Návrh', other: '💬 Jiné' }
  const text = String(d.text || '').slice(0, 5000)
  const kind = kinds[d.kind] || '💬'
  const subject = '[Char Tracker] ' + kind + ': ' + text.split('\n')[0].slice(0, 60)
  const body =
    'Od: ' + String(d.name || '') + ' <' + String(d.email || '') + '>\n' +
    'Druh: ' + kind + '\n' +
    'Stránka: ' + String(d.page || '') + '\n\n' +
    text + '\n\n' +
    'Všechny zpětné vazby: ' + String(d.appUrl || '') + '#/feedback'
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: subject, body: body, replyTo: String(d.email || '') || undefined })
  return ContentService.createTextOutput('ok')
}
```

## Poznámky

- Odpověď na mail jde rovnou autorovi zpětné vazby (Reply-To).
- URL skriptu je uložená ve Firestore (`config/notify`), ne v tomhle veřejném repozitáři. Číst ji může každý přihlášený uživatel, takže skript má limit 30 mailů za hodinu proti spamu. Kdyby ho někdo zneužíval, stačí udělat nové nasazení a vložit novou URL.
- Samotná zpětná vazba se uloží i bez mailu; e-mail je jen upozornění.
