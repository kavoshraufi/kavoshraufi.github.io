import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawWateringCan, playSfx, playNote, bgPoint,
} from '../core.js';

export const level03 = {
  id: 'garden',
  shortTitle: 'Trädgård',
  title: 'Trädgårdsmagin',
  icon: '🌻',
  bg: 'tradgard',
  tint: '#d9dfb8',
  goalTotal: 4,
  goalIcon: '🌸',
  bookDesc: 'Färgsprakande blommor som vattnats med systrarnas vattenkanna!',

  create(api) {
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
      dragKind: null, // { type:'seed', kind } | { type:'can' }
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
          b.x = p.x; b.y = p.y;
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
        s.heroPos = [hp.x, hp.y];
        s.buddyPos = [bp.x, bp.y];
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
        playNote(bed.i, 0.35);
        api.particles.burst(bed.x, bed.y - 54, 18, { kind: 'star', colors: [bed.kind.color, '#ffe17a', '#ffffff'] });
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

        // Vattna kontinuerligt när kannan hålls över en sådd bädd!
        s.pouringBed = null;
        if (s.canHeld) {
          for (const b of s.beds) {
            if (b.stage === 1 && dist(s.canX - 30, s.canY + 14, b.x, b.y - 20) < 72) {
              s.pouringBed = b;
              waterBed(b, dt * 1.45);
              break;
            }
          }
        }

        s.butterfly.x = lerp(s.butterfly.x, s.butterfly.tx, Math.min(1, dt * 3));
        s.butterfly.y = lerp(s.butterfly.y, s.butterfly.ty, Math.min(1, dt * 3));
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Vattenkanna
        if (dist(x, y, s.canX, s.canY) < 52) {
          s.canHeld = true;
          s.dragKind = { type: 'can' };
          playSfx('ok');
          return;
        }

        // 2. Fröpåse
        for (const p of s.packets) {
          if (!p.used && dist(x, y, p.x, p.y) < 42) {
            s.dragKind = { type: 'seed', packet: p };
            playSfx('ok');
            return;
          }
        }

        // 3. Tryck direkt på tom bädd om en påse finns → snällt autoförslag / så närmaste!
        for (const b of s.beds) {
          if (dist(x, y, b.x, b.y - 18) < 52) {
            if (b.stage === 0) {
              const firstUnused = s.packets.find((p) => !p.used);
              if (firstUnused) sowBed(b, firstUnused);
              return;
            }
            if (b.stage === 1) {
              // Snabbt tryck vattnar också direkt så små barn aldrig fastnar!
              s.canX = b.x + 36; s.canY = b.y - 54;
              waterBed(b, 0.52);
              return;
            }
            if (b.stage === 2) {
              b.popT = 1;
              playNote(b.i, 0.35);
              s.butterfly.tx = b.x; s.butterfly.ty = b.y - 78;
              api.particles.burst(b.x, b.y - 52, 10, { colors: [b.kind.color, '#ffe17a'] });
              return;
            }
          }
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
        if (!s.dragKind) return;
        if (s.dragKind.type === 'can') {
          s.canX = x; s.canY = y;
        } else if (s.dragKind.type === 'seed') {
          s.dragKind.packet.x = x; s.dragKind.packet.y = y;
        }
      },

      onUp() {
        if (s.dragKind && s.dragKind.type === 'seed') {
          const p = s.dragKind.packet;
          for (const b of s.beds) {
            if (b.stage === 0 && dist(p.x, p.y, b.x, b.y - 12) < 68) {
              sowBed(b, p);
              break;
            }
          }
          p.x = p.homeX; p.y = p.homeY;
        }
        s.canHeld = false;
        s.pouringBed = null;
        s.dragKind = null;
        s.canX = s.canHomeX; s.canY = s.canHomeY;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Mjuka odlingskrukor/bäddar (aldrig svarta fläckar!)
        for (const b of s.beds) {
          const needSeed = s.dragKind?.type === 'seed' && b.stage === 0;
          const needWater = (s.dragKind?.type === 'can' || b.stage === 1) && b.stage === 1;
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
          const held = s.dragKind?.packet === p;
          if (!held && s.beds.some((b) => b.stage === 0)) {
            drawGlowRing(ctx, T, p.x, p.y, 26, 'rgba(255, 226, 120, 0.5)');
          }
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
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.80, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.80, { ...d2, who: buddyId, scale: heroScale, face: -1 });
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
        const needAnyWater = s.beds.some((b) => b.stage === 1);
        if (needAnyWater && !s.canHeld) {
          drawGlowRing(ctx, T, s.canX, s.canY, 34, 'rgba(126, 212, 255, 0.75)');
        }
        drawWateringCan(ctx, s.canX, s.canY, s.pouringBed ? -0.45 : (s.canHeld ? -0.15 : 0), !!s.pouringBed, T);

        // Pekhand
        if (!api.won && (s.beds.every((b) => b.stage === 0) || s.idleT > 2.8)) {
          const seeded = s.beds.find((b) => b.stage === 1);
          const empty = s.beds.find((b) => b.stage === 0);
          const pkt = s.packets.find((p) => !p.used);
          if (seeded) drawGuideHand(ctx, T, s.canX, s.canY, seeded.x + 24, seeded.y - 38);
          else if (empty && pkt) drawGuideHand(ctx, T, pkt.x, pkt.y, empty.x, empty.y - 12);
        }
      },
    };
  },
};
