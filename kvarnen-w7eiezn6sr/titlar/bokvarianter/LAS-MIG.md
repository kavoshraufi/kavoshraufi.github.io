# Bokvarianter – Rostam och Sohrab, natt 1

Tre fristående testvarianter av samma kapitel. Ingenting är publicerat.

## Öppna lokalt

Stå i den här mappen och visa den via en enkel webbserver, till exempel:

    python3 -m http.server 8767 --bind 127.0.0.1

Sedan: [http://127.0.0.1:8767/](http://127.0.0.1:8767/)

- `variant-a/` — Ljus bok
- `variant-b/` — Bildbok
- `variant-c/` — Klassisk enkel

Liggande läge. I stående visas ”Vrid telefonen”.

## In i Kvarnen-testappen

Kopiera **hela** katalogen `bokvarianter` (inte bara en variant), så att de relativa sökvägarna till `delat/`, `konst/` och `lasare.js` fortsätter att stämma. Till exempel:

    titlar/bokvarianter/variant-a/
    titlar/bokvarianter/variant-b/
    titlar/bokvarianter/variant-c/

`delat` och `konst` är symboliska länkar till Rostam-referensens filer. Om länkarna inte följer med, kopiera målen:

- `delat` → `/workspace/rostam-och-sohrab/referens/delat`
- `konst` → `/workspace/rostam-och-sohrab/referens/konst`

Publicera inte utan Kavoshs ja.

## Tester

    node tests/play.mjs

Resultatet sparas i `tests/resultat.json` och skärmdumpar i `shots/`.
