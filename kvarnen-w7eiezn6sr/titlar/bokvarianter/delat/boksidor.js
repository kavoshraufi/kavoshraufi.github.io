/** Ritar pergament-sidor till canvas (ingen extern grafik). */

function brus(ctx, w, h, alfa = 0.07) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 200 + Math.random() * 40;
    d[i] = n;
    d[i + 1] = n - 12;
    d[i + 2] = n - 40;
    d[i + 3] = Math.floor(255 * alfa);
  }
  ctx.putImageData(img, 0, 0);
}

function radbryt(ctx, text, maxW) {
  const ord = String(text).split(/\s+/);
  const rader = [];
  let rad = '';
  for (const o of ord) {
    const prova = rad ? `${rad} ${o}` : o;
    if (ctx.measureText(prova).width > maxW && rad) {
      rader.push(rad);
      rad = o;
    } else rad = prova;
  }
  if (rad) rader.push(rad);
  return rader;
}

export async function vantaTypsnitt() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load('16px "Cormorant Garamond"');
    await document.fonts.load('italic 16px "Cormorant Garamond"');
    await document.fonts.load('20px Cinzel');
    await document.fonts.ready;
  } catch {
    /* systemfallback */
  }
}

export function ritaBoksida(cssW, cssH, { rubrik, text, folio, typ = 'brod', dpr = 2 } = {}) {
  const c = document.createElement('canvas');
  const w = Math.max(2, Math.round(cssW * dpr));
  const h = Math.max(2, Math.round(cssH * dpr));
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const grund = typ === 'omslag' ? '#3a2a1c' : typ === 'kolofon' ? '#efe3c4' : '#f3e6c8';
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, w, h);

  if (typ === 'omslag') {
    ctx.fillStyle = 'rgba(196,164,106,0.15)';
    ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
    ctx.strokeStyle = 'rgba(196,164,106,0.7)';
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
    ctx.fillStyle = '#f6eedc';
    ctx.font = `${Math.round(w * 0.09)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rubrik || 'Kvarnen', w / 2, h * 0.46);
    ctx.font = `italic ${Math.round(w * 0.045)}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#c4a46a';
    ctx.fillText(text || '', w / 2, h * 0.58);
    return c;
  }

  // marginaler
  ctx.save();
  brus(ctx, w, h, typ === 'flygblad' ? 0.05 : 0.08);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(80,50,20,0.08)');
  g.addColorStop(0.08, 'rgba(80,50,20,0)');
  g.addColorStop(0.92, 'rgba(255,255,240,0)');
  g.addColorStop(1, 'rgba(80,50,20,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const mx = w * 0.14;
  const my = h * 0.13;
  ctx.fillStyle = '#2a2118';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (typ === 'flygblad') {
    ctx.fillStyle = 'rgba(42,33,24,0.35)';
    ctx.font = `italic ${Math.round(w * 0.045)}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text || '', w / 2, h * 0.48);
    return c;
  }

  let y = my;
  if (rubrik) {
    ctx.font = `${Math.round(w * 0.07)}px Cinzel, serif`;
    ctx.fillStyle = '#2a2118';
    const rader = radbryt(ctx, rubrik, w - mx * 2);
    for (const r of rader) {
      ctx.fillText(r, mx, y);
      y += w * 0.09;
    }
    y += h * 0.03;
    ctx.strokeStyle = 'rgba(196,164,106,0.7)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(mx, y);
    ctx.lineTo(w - mx, y);
    ctx.stroke();
    y += h * 0.05;
  }

  if (text) {
    ctx.font = `${Math.round(w * 0.048)}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#2a2118';
    const lh = w * 0.072;
    const stycken = String(text).split('\n');
    for (const st of stycken) {
      const rader = radbryt(ctx, st, w - mx * 2);
      for (const r of rader) {
        if (y > h - my * 1.2) break;
        ctx.fillText(r, mx, y);
        y += lh;
      }
      y += lh * 0.35;
    }
  }

  if (folio != null) {
    ctx.font = `${Math.round(w * 0.036)}px Cinzel, serif`;
    ctx.fillStyle = 'rgba(42,33,24,0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(folio), w / 2, h - h * 0.06);
  }
  return c;
}

export const DEMO_SIDOR = [
  { typ: 'flygblad', text: 'SkaparKvarnen' },
  { typ: 'omslag', rubrik: 'Kvarnen vid ån', text: 'En liten visning av fundamentet' },
  { typ: 'brod', rubrik: 'Kvällen', text: 'När skuggan nådde kvarnhjulet tystnade ån ett ögonblick, som om den lyssnade. Dammet i luften stod stilla. Det luktade varmt trä och kallt vatten.', folio: 3 },
  { typ: 'brod', text: 'Inne i huset låg en bok uppslagen på bordet. Bladen hade den där mjuka kanten som bara kommer av att någon vänt dem ofta, utan brådska.', folio: 4 },
  { typ: 'brod', rubrik: 'Bladet', text: 'Man kan tro att en sida bara är papper. Men när den lyfts hörs först ett litet friktionsljud, sedan en kort båge i luften, och till sist landningen mot nästa blad.', folio: 5 },
  { typ: 'brod', text: 'Det är den rörelsen den här demosidan vill mer än något annat: att fingret får leda, att vikten följer med, och att boken själv avgör om den ska vända eller falla tillbaka.', folio: 6 },
  { typ: 'brod', rubrik: 'Spara', text: 'Till höger om ån står en liten lykta. Den minns var du var. Tryck Spara, eller låt den göra det tyst. Fortsätt en annan kväll. Börja om bara om du verkligen vill.', folio: 7 },
  { typ: 'kolofon', rubrik: 'Slut för i kväll', text: 'Ljuden är inspelade papper, inte oscillatorer. Rummet är ett ritat eko. Vänd gärna tillbaka.', folio: 8 },
];

export async function byggDemosidor(cssW, cssH) {
  await vantaTypsnitt();
  return DEMO_SIDOR.map((s) => ritaBoksida(cssW, cssH, s));
}
