import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand, drawGuideHold,
  drawWateringCan, playSfx, playNote, bgPoint,
} from '../core.js';

export const level03 = {
  id: 'garden',
  shortTitle: 'Trädgård',
  title: 'Trädgårdsmagin',
  art: 'solros',
  bg: 'tradgard',
  tint: '#d9dfb8',
  goalTotal: 4,
  rounds: 3,
  goalArt: 'blomma',
  bookDesc: 'Färgsprakande blommor som vattnats med systrarnas vattenkanna!',

  create(api) {
    // 1.9: ny kärnverb — HÅLL KVAR. Tryck på en bädd så sår systrarna (välj gärna färg på en fröpåse först),
    // och HÅLL sedan fingret på bädden: kannan häller och blomman växer så länge du håller.
    const R = api.round || 1;
    const RATE = 0.92 / (R === 1 ? 1.1 : R === 2 ? 1.4 : 1.7); // vatten/s medan man håller
    const KINDS = [
      { id: 'yellow', color: '#ffd24c', center: '#a85d1a', name: 'Solros' },
      { id: 'pink', color: '#ff78a8', center: '#ffe88a', name: 'Tulpan' },
      { id: 'blue', color: '#6ec4ff', center: '#fff3a8', name: 'Blåklocka' },
      { id: 'purple', color: '#ba84ff', center: '#ffd966', name: 'Vallmo' },
    ];

    const s = {
      idleT: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      dragKind: null,
      valdPacket: null,
      holdBed: null,
      canTilt: 0,
      canX: 0,
      canY: 0,
      canHomeX: 0,
      canHomeY: 0,
      canHeld: false,
      pouringBed: null,
      waterSfxCd: 0,
      beds: [0, 1, 2, 3].map((i) => ({
        i, x: 0, y: 0, kind: null, stage: 0, // 0=empty, 1=seeded, 2=blooming
        water: 0, // 0..1
        popT: 0,
      })),
      packets: KINDS.map((k, i) => ({ ...k, i, x: 0, y: 0, homeX: 0, homeY: 0, used: false })),
      butterfly: { x: 0, y: 0, tx: 0, ty: 0 },
      inited: false,
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      if (land) {
        // Bäddar, påsar och kanna enbart som interaktiva objekt på den rena gräsmattan, till höger om stenstigen.
        const bedPts = [[360, 336], [460, 318], [560, 318], [650, 336]];
        s.beds.forEach((b, i) => {
          const p = bgPoint(W, H, 'tradgard', bedPts[i][0], bedPts[i][1]);
          b.x = p.x; b.y = Math.min(p.y, pr.y + pr.h - 24);
        });
        const pktXs = [360, 430, 500, 570];
        s.packets.forEach((p, i) => {
          const q = bgPoint(W, H, 'tradgard', pktXs[i], 258);
          p.homeX = q.x; p.homeY = q.y;
          if (!s.dragKind || s.dragKind.packet !== p) {
            p.x = p.homeX;
            p.y = p.homeY;
          }
        });
        const ch = bgPoint(W, H, 'tradgard', 655, 248);
        s.canHomeX = ch.x; s.canHomeY = ch.y;
        if (!s.canHeld) {
          s.canX = s.canHomeX;
          s.canY = s.canHomeY;
        }
        const hp = bgPoint(W, H, 'tradgard', 90, 368);
        const bp = bgPoint(W, H, 'tradgard', 690, 368);
        s.heroPos = [hp.x, Math.min(hp.y, pr.y + pr.h)];
        s.buddyPos = [bp.x, Math.min(bp.y, pr.y + pr.h)];
      } else {
        const bedXs = [0.24, 0.76, 0.24, 0.76];
        const bedYs = [0.42, 0.42, 0.62, 0.62];
        s.beds.forEach((b, i) => {
          b.x = pr.x + pr.w * bedXs[i];
          b.y = pr.y + pr.h * bedYs[i];
        });
        s.packets.forEach((p, i) => {
          p.homeX = pr.x + pr.w * (0.16 + i * 0.18);
          p.homeY = pr.y + pr.h * 0.22;
          if (!s.dragKind || s.dragKind.packet !== p) {
            p.x = p.homeX;
            p.y = p.homeY;
          }
        });
        s.canHomeX = pr.x + pr.w * 0.84;
        s.canHomeY = pr.y + pr.h * 0.22;
        if (!s.canHeld) {
          s.canX = s.canHomeX;
          s.canY = s.canHomeY;
        }
        s.heroPos = [pr.x + pr.w * 0.17, pr.y + pr.h * 0.88];
        s.buddyPos = [pr.x + pr.w * 0.83, pr.y + pr.h * 0.88];
      }
      if (!s.inited) {
        s.butterfly.x = pr.x + pr.w * 0.5;
        s.butterfly.y = pr.y + pr.h * 0.35;
        s.butterfly.tx = s.butterfly.x;
        s.butterfly.ty = s.butterfly.y;
        s.inited = true;
      }
      return pr;
    }

    function drawBloom(ctx, T, b) {
      if (!b.kind) return;
      const g = b.water; // 0..1
      const h = 14 + g * 48;
      ctx.save();
      ctx.translate(b.x, b.y - 6);
      // Stjälk
      ctx.strokeStyle = '#4e9644';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.sin(T * 2 + b.i) * 4, -h * 0.5, 0, -h);
      ctx.stroke();

      // Blad
      ctx.fillStyle = '#6ec05f';
      ctx.beginPath(); ctx.ellipse(-10, -h * 0.45, 9, 4.5, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, -h * 0.55, 9, 4.5, 0.4, 0, TAU); ctx.fill();

      if (b.stage >= 2) {
        const sc = 1 + Math.sin(b.popT * Math.PI) * 0.25;
        ctx.translate(0, -h);
        ctx.scale(sc, sc);
        const petals = b.kind.id === 'yellow' ? 10 : 6;
        for (let k = 0; k < petals; k++) {
          const ang = (k / petals) * TAU + T * 0.25;
          ctx.fillStyle = b.kind.color;
          ctx.strokeStyle = 'rgba(80, 50, 20, 0.35)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(Math.cos(ang) * 14, Math.sin(ang) * 14, 10, 6.5, ang, 0, TAU);
          ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = b.kind.center;
        ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.fill();
      } else {
        // Knopp som sväller
        ctx.fillStyle = b.kind.color;
        ctx.beginPath(); ctx.arc(0, -h, 5 + g * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    function sowBed(bed, packet) {
      if (bed.stage !== 0) return false;
      bed.kind = packet;
      bed.stage = 1;
      bed.water = 0.08;
      packet.used = true;
      s.heroExpr = 'forvanad';
      s.heroExprT = 0.9;
      s.heroJump = 0.45;
      playSfx('plant');
      api.particles.burst(bed.x, bed.y - 12, 12, { colors: [packet.color, '#ffe17a', '#9ee284'] });
      return true;
    }

    function bloomMagic(bed) {
      const k = bed.kind.id;
      if (k === 'yellow') {
        playNote(4, 0.4);
        api.particles.burst(bed.x, bed.y - 56, 18, { kind: 'star', colors: ['#ffd24c', '#fff7b0', '#ffffff'] });
      } else if (k === 'pink') {
        playNote(2, 0.4);
        api.particles.burst(bed.x, bed.y - 56, 18, { kind: 'heart', colors: ['#ff78a8', '#ffc2d8', '#ffffff'] });
      } else if (k === 'blue') {
        playNote(5, 0.42);
        api.particles.burst(bed.x, bed.y - 56, 18, { kind: 'star', colors: ['#6ec4ff', '#cceeff', '#ffffff'] });
      } else {
        playNote(3, 0.42);
        api.particles.burst(bed.x, bed.y - 56, 18, { kind: 'star', colors: ['#ba84ff', '#ffe885', '#ffffff'] });
      }
    }

    function waterBed(bed, amount) {
      if (bed.stage !== 1) return;
      bed.water = clamp(bed.water + amount, 0, 1);
      if (s.waterSfxCd <= 0) {
        s.waterSfxCd = 0.26;
        playSfx('water');
      }
      if (bed.water >= 1) {
        bed.stage = 2;
        bed.popT = 1;
        s.heroExpr = 'skratt';
        s.heroExprT = 1.1;
        s.heroJump = 1;
        s.buddyJump = 0.9;
        playSfx('pling');
        bloomMagic(bed);
        s.butterfly.tx = bed.x;
        s.butterfly.ty = bed.y - 78;
        const done = s.beds.filter((b) => b.stage === 2).length;
        api.setProgress(done);
        if (done >= 4) api.win(3);
      }
    }

    return {
      _s: s,
      update(dt, W, H) {
        layout(W, H);
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.3);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.3);
        if (s.waterSfxCd > 0) s.waterSfxCd -= dt;
        for (const b of s.beds) if (b.popT > 0) b.popT = Math.max(0, b.popT - dt * 2.5);

        // Håll kvar på en sådd bädd → kannan svävar dit och häller så länge fingret ligger kvar
        s.pouringBed = null;
        if (s.canTilt > 0) s.canTilt = Math.max(0, s.canTilt - dt * 1.8);
        if (s.holdBed && s.holdBed.stage === 1) {
          s.pouringBed = s.holdBed;
          s.canHeld = true;
          s.canX = lerp(s.canX, s.holdBed.x + 40, Math.min(1, dt * 14));
          s.canY = lerp(s.canY, s.holdBed.y - 62, Math.min(1, dt * 14));
          s.idleT = 0;
          waterBed(s.holdBed, dt * RATE);
          if (Math.random() < dt * 10) api.particles.burst(s.holdBed.x + (Math.random() - 0.5) * 30, s.holdBed.y - 20, 2, { colors: ['#8fd3ff', '#ffffff'], speed: 30, lift: -20, life: 0.4 });
        } else {
          if (s.holdBed && s.holdBed.stage !== 1) s.holdBed = null;
          s.canHeld = false;
        }

        s.butterfly.x = lerp(s.butterfly.x, s.butterfly.tx, Math.min(1, dt * 3));
        s.butterfly.y = lerp(s.butterfly.y, s.butterfly.ty, Math.min(1, dt * 3));
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 0. Sådd bädd: håll kvar för att vattna (målet går alltid före kanna/påsar)
        for (const b of s.beds) {
          if (b.stage === 1 && dist(x, y, b.x, b.y - 18) < 48) {
            s.holdBed = b;
            s.waterSfxCd = 0;
            waterBed(b, 0.03);
            api.particles.burst(b.x, b.y - 24, 8, { colors: ['#8fd3ff', '#ffffff'], speed: 70 });
            return;
          }
        }

        // 1. Kannan: vickar och stänker (lek)
        if (dist(x, y, s.canX, s.canY) < 46) {
          s.canTilt = 1;
          playSfx('water');
          api.particles.burst(s.canX - 30, s.canY + 10, 10, { colors: ['#8fd3ff', '#ffffff'], speed: 90 });
          return;
        }

        // 2. Fröpåse: välj färg till nästa sådd (frivilligt val)
        for (const p of s.packets) {
          if (!p.used && dist(x, y, p.x, p.y) < 34) {
            s.valdPacket = p;
            playSfx('ok');
            api.particles.burst(p.x, p.y, 8, { colors: [p.color, '#ffffff'] });
            return;
          }
        }

        // 3. Tom bädd → så (vald påse eller nästa), blommande bädd → blomman sjunger
        for (const b of s.beds) {
          if (dist(x, y, b.x, b.y - 18) < 52) {
            if (b.stage === 0) {
              const pk = (s.valdPacket && !s.valdPacket.used) ? s.valdPacket : s.packets.find((p) => !p.used);
              if (pk) { sowBed(b, pk); s.valdPacket = null; }
              return;
            }
            if (b.stage === 2) {
              b.popT = 1;
              bloomMagic(b);
              s.butterfly.tx = b.x; s.butterfly.ty = b.y - 78;
              return;
            }
          }
        }

        // 3b. Fjärilen dansar och kvittrar när man rör den!
        if (dist(x, y, s.butterfly.x, s.butterfly.y) < 46) {
          const pr = layout(W, H);
          s.butterfly.tx = pr.x + pr.w * (0.28 + Math.random() * 0.44);
          s.butterfly.ty = pr.y + pr.h * (0.22 + Math.random() * 0.28);
          playSfx('pling');
          playNote(5, 0.3);
          api.particles.burst(s.butterfly.x, s.butterfly.y, 12, { kind: 'star', colors: ['#ffe17a', '#ff9ec4', '#ffffff'] });
          return;
        }

        // 4. Systrarna
        if (s.heroPos && dist(x, y, s.heroPos[0], s.heroPos[1] - 42) < 54) {
          s.heroJump = 1; s.heroExpr = 'skratt'; s.heroExprT = 0.9;
          playSfx('cheer');
          api.particles.burst(s.heroPos[0], s.heroPos[1] - 54, 10, { kind: 'heart' });
          return;
        }
        if (s.buddyPos && dist(x, y, s.buddyPos[0], s.buddyPos[1] - 42) < 54) {
          s.buddyJump = 1;
          playSfx('pling');
          api.particles.burst(s.buddyPos[0], s.buddyPos[1] - 54, 10, { kind: 'star' });
          return;
        }

        playSfx('tap');
        api.particles.burst(x, y, 6, { colors: ['#fff0a6', '#a8e38a'] });
      },

      onMove(x, y) {
        // Glider fingret bort från bädden slutar kannan hälla (ingen bestraffning, vattnet stannar kvar)
        if (s.holdBed && dist(x, y, s.holdBed.x, s.holdBed.y - 18) > 80) s.holdBed = null;
      },

      onUp() {
        s.holdBed = null;
        s.canHeld = false;
        s.pouringBed = null;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Mjuka odlingskrukor/bäddar (aldrig svarta fläckar!)
        for (const b of s.beds) {
          const needSeed = b.stage === 0 && !s.beds.some((o) => o.stage === 1);
          const needWater = b.stage === 1;
          if (needSeed || needWater) {
            drawGlowRing(ctx, T, b.x, b.y - 14, 38, needSeed ? 'rgba(255, 224, 110, 0.8)' : 'rgba(130, 214, 255, 0.85)');
          }
          drawShadow(ctx, b.x, b.y + 8, 34, 9);
          ctx.save();
          ctx.fillStyle = '#c88d5b';
          ctx.strokeStyle = '#734b2a';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, 32, 12, 0, 0, TAU);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#99673e';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - 2, 24, 7.5, 0, 0, TAU);
          ctx.fill();
          ctx.restore();

          drawBloom(ctx, T, b);
        }

        // Fröpåsar längs ovankanten
        for (const p of s.packets) {
          if (p.used) continue;
          const held = s.valdPacket === p;
          if (held) drawGlowRing(ctx, T, p.x, p.y, 26, 'rgba(255, 226, 120, 0.8)');
          ctx.save();
          ctx.translate(p.x, p.y + (held ? -6 : Math.sin(T * 2.5 + p.i) * 3));
          ctx.scale(held ? 1.15 : 1, held ? 1.15 : 1);
          ctx.fillStyle = '#fbf3de';
          ctx.strokeStyle = '#7c5b37';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(-18, -22, 36, 44, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
          ctx.restore();
        }

        // Fjäril som besöker blommorna
        blit(ctx, 'butterfly', s.butterfly.x, s.butterfly.y + Math.sin(T * 5) * 6, { h: 46 });

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.14;
        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.62, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.62, { ...d2, who: buddyId, scale: heroScale, face: -1 });
        } else {
          drawHero(ctx, T, s.heroPos[0], s.heroPos[1], {
            who: leadId, scale: heroScale, expr: s.heroExpr,
            pose: s.heroJump > 0 ? 'jump' : 'cheer',
            bob: s.heroJump > 0 ? -Math.sin(s.heroJump * Math.PI) * 26 : 0, face: 1,
          });
          drawHero(ctx, T, s.buddyPos[0], s.buddyPos[1], {
            who: buddyId, scale: heroScale * 0.9,
            expr: s.buddyJump > 0 ? 'skratt' : 'glad',
            pose: s.buddyJump > 0 ? 'jump' : 'idle',
            bob: s.buddyJump > 0 ? -Math.sin(s.buddyJump * Math.PI) * 24 : 0, face: -1,
          });
        }

        // Vattenkanna (lutar & häller stråle!)
        if (!s.canHeld) { s.canX = lerp(s.canX, s.canHomeX, 0.2); s.canY = lerp(s.canY, s.canHomeY, 0.2); }
        drawWateringCan(ctx, s.canX, s.canY, s.pouringBed ? -0.45 : -Math.sin(s.canTilt * Math.PI) * 0.5, !!s.pouringBed || s.canTilt > 0.3, T);

        // Pekhand
        if (!api.won && (s.beds.every((b) => b.stage === 0) || s.idleT > 2.0)) {
          const seeded = s.beds.find((b) => b.stage === 1);
          const empty = s.beds.find((b) => b.stage === 0);
          if (seeded && !s.holdBed) drawGuideHold(ctx, T, seeded.x, seeded.y - 18, Math.ceil((1 - seeded.water) / RATE * 1000) + 300);
          else if (empty && !seeded) drawGuideHand(ctx, T, empty.x + 6, empty.y - 12);
        }
      },
    };
  },
};
