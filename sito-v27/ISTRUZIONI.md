# Accademia della Guida · nuova grafica (v27)

File da sostituire nel progetto originale (stessi percorsi):

| File | Cosa cambia |
|---|---|
| `app/_content/home.html` | Nuova grafica della home. Testi, sezioni, slide, moto, configuratore e dati SEO invariati. |
| `content/translations.json` | Tre voci in più per i testi nuovi (titolo e frase sulla durata). |
| `public/booking.js` | Il cliente sceglie solo 1 h, 1 h 30 o 2 h. Dal pannello di gestione restano tutte le durate. |
| `lib/bookings.ts` | Il server rifiuta prenotazioni dei clienti oltre le 2 ore. |

## Messaggio da dare a ChatGPT

> Sostituisci nel progetto Accademia della Guida questi quattro file con le versioni allegate, senza modificare altro:
> `app/_content/home.html`, `content/translations.json`, `public/booking.js`, `lib/bookings.ts`.
> Poi porta da `?v=8` a `?v=9` il riferimento a `/booking.js` in `app/prenotazioni/route.ts` e in
> `app/_content/statistiche.html`, esegui i test e pubblica solo se passano. Non toccare il database né le prenotazioni.

## Note

- `anteprima/` contiene le schermate di computer e telefono. Nelle schermate le foto sono segnaposto grigi:
  online compaiono le foto e i video reali del sito.
- `strumenti/` contiene lo script e il foglio di stile usati per generare la home a partire dalla versione 26.
- Una prenotazione già esistente più lunga di 2 ore resta valida; il cliente però non può modificarla da solo.
