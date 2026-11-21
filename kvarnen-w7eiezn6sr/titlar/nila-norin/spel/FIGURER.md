# Figurer i Nila & Norin

Det finns ännu inga riktiga bilder på Nila och Norin. Spelet använder **tillfälliga, stiliserade sagofigurer** i akvarellstil. Inga foton av verkliga barn, inga gråa lådor.

## Var filerna ligger

Lägg ett bildark per flicka här (referensspelet):

- `figurer/nila.webp`
- `figurer/norin.webp`

När filerna saknas ritar spelet samma tillfälliga figurer från `konst/sprites.webp` (uttrycken glad, skratt, förvånad, vinkar). Procedurritning används bara som sista reserv, i samma färger som paletten – aldrig som en grå ruta.

## Format på bildarket

Samma kontrakt som i `karaktarer/README.md`:

- Ett ark per flicka, **sju uttryck i en rad**, i den här ordningen:
  1. glad
  2. skratt
  3. förvånad (`forvanad`)
  4. busig
  5. modig
  6. fundersam
  7. ledsen-mjuk (`ledsen`)
- Rekommenderad storlek: **1792 × 256** pixlar (sju rutor om 256 × 256).
- Figuren i mitten av rutan, fötterna nära nederkanten.
- Bakgrund: magenta `#FF00FF` (tas bort som nyckel, eller lämna som genomskinlig webbp).
- Ingen text i bilden. Akvarell/gouache, mjuka kanter, synligt papperskorn gärna.

## Så byter du när de riktiga bilderna kommer

1. Exportera två webp-ark enligt formatet ovan.
2. Ersätt `referens/figurer/nila.webp` och `referens/figurer/norin.webp`.
3. Ladda om spelet. Ingen kodändring behövs, så länge storleken är sju lika breda rutor i en rad.
4. Om ett uttryck ska ligga i en annan ruta: ändra bara konstanten `EXPR` i `js/spel.js` så att ordningen stämmer.

Tillfällig atlas i `konst/sprites.webp` rör du inte när du byter ansikten – den håller djur, kistor och bakverk.

Testkroken `window.__ak.setSprite("nila", dataUrl)` och `__ak.loadSprites()` finns kvar om du vill prova ett ark utan att spara filen.

## Tillfälliga ark just nu

`figurer/nila.webp` och `figurer/norin.webp` är tillfälliga ark, utskurna ur den stiliserade målningen `bilder-kalla/flickor-tillfalliga.jpg`. De följer formatet ovan (1792×256, sju rutor, genomskinlig bakgrund). Uttrycken **modig**, **fundersam** och **ledsen** återanvänder tills vidare glad respektive förvånad. Ersätt bara de två filerna när riktiga sju-uttrycksark finns.

Spelet tar bort magenta `#FF00FF` (och närliggande rosa) som nyckel, så nya ark kan ha antingen magenta eller genomskinlig bakgrund.
