# Versioner — Kvarnen (test)

Appens synliga nummer och service workerns cache-namn kommer från samma konstant i `kvarnen-w7eiezn6sr/version.js` (`KVARNEN_APP_VERSION`). Från och med 2.0 blir en utgåva cache-namnet `kvarnen-test-pages-v` plus versionsnumret med bindestreck (`2.0` → `kvarnen-test-pages-v2-0`), så att telefoner hämtar den nya service workern. Äldre 1.x-utgåvor hette `kvarnen-test-pages-v` plus sista siffran (1.4 → `v4`).

## 2.0

Ny utgåva av både Nila & Norin – Äventyrsdalen och Drakis resa.

I Nila & Norin styrs systrarna av en gemensam HeroStage i alla tio banor, utan klonade figurer. Sorteringsstugan visar inte längre en tom önskebubbla och flickorna står på golvet. Musikgläntan och Skattjakten har kortare stillestånd, och grävning, gång och kanter (bland annat i skattjakten och molnbanan) beter sig mer trovärdigt.

I Drakis resa används pixelfonten överallt, knappar har nedtryckta lägen, dialoger köas och bossen krymper i diskreta pixelsteg. Spelet har mer juice och tydligare konturer, pekkontrollerna ligger i sidomarginalerna i liggande läge, och ädelstensbutiken säljer fem boosts. Drakis storlek är låst till DRAKIS_SCALE 1.0.

## 1.9

Stor mobil- och speluppdatering av Nila & Norin – Äventyrsdalen. Alla tio banor har fått rundor med stegrad utmaning, tre meningsfulla stjärnor per bana (klarad, gömt mynt, hälsat på besökare), varierade kärnverb, handmålade ikoner i stället för emoji samt mjuk respons utan döda tryck. Dessutom mobilförbättringar: säkra zoner runt skärmkanter, stöd för orienteringsbyte mitt i bana, paus när fliken döljs, prioriterad ljud- och bildladdning för långsam uppkoppling, bredare brofästen i stående läge och HUD/stjärnor som hålls kvar på skärmen.

## 1.8

Visuell puts i Nila & Norin – Äventyrsdalen. Trädgårdsmagin har en ren gräsmatta utan de målade rabatterna, fröpåsarna och vattenkannan som tidigare låg under de interaktiva objekten, och titeln sitter inte längre på en bädd. I Lilla Bagaren står gästerna på diskens framkant i stället för att sväva över glaskupan, och titeln har mer luft till ingrediensbrickan. Vinstknapparna håller sig på en rad även i 667×375.

## 1.7

Nila & Norin byts ut mot den ombyggda versionen Äventyrsdalen. Spelet har karta, skattbok, föräldrameny och tio banor med olika lekar: Djurräddningen, Bäckplask, Trädgårdsmagin, Sorteringsstugan, Musikgläntan, Molnäventyret, Brobyggaren, Stjärnhimlen, Skattjakten och Lilla Bagaren.

## 1.6

Nila & Norin läggs till i hyllan som egen titel (tillfälliga sagofigurer, se spelets FIGURER.md). Tre testvarianter av Rostam och Sohrab, natt 1, läggs också in: Bok A – Ljus bok, Bok B – Bildbok och Bok C – Klassisk enkel.

## 1.5

Rättar färger och storlek i Drakis resa. Den förra referensen hade låst all grafik till 32 färger (Endesga), vilket gav fläckiga, felaktiga färger, och många sprites var uppskalade cirka 4 gånger så att Drakis blev för stor i förhållande till banan. Originalgrafiken med rätt färger och storlek är tillbaka.

## 1.4

Pålitligare uppdateringar: HTML hämtas nätverk-först, övriga tillgångar med stale-while-revalidate. Service workern registreras med `updateViaCache: 'none'` och söker efter nytt när appen startar eller blir synlig igen. Hyllan laddas om av sig själv när en ny version finns; inne i en titel visas i stället rutan *Ny version finns* med det nya numret. Versionsnumret syns diskret i hyllan.

## 1.3

Ny referensversion av Drakis resa (ES-moduler) ersatte den gamla titeln. Nytt omslag i hyllan.

## 1.2

Ny referensversion av Rostam och Sohrab ersatte den gamla titeln. Nytt omslag i hyllan.

## 1.1

Första testappen på GitHub Pages: en hylla med Drakis resa, Rostam och Sohrab och Det gyllene manuskriptet.
