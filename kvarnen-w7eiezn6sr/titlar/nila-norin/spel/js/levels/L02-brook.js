import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawWatercolorBubble, drawBasket, playSfx, playNote,
} from '../core.js';

export const level02 = {
  id: 'brook',
  shortTitle: 'Bäck',
  title: 'Bäckplask',
  icon: '🫧',
  bg: 'back',
  tint: '#b8d7cd',
  goalTotal: 8,
  goalIcon: '🫧',
  bookDesc: 'Regnbågsbubblor och lövbåtar vid den klara skogsbäcken!',

  create(api) {
    const TREATS = ['berry', 'star', 'sunflower', 'berry', 'star', 'berry', 'sunflower', 'star'];
    const HUES = ['#88dbff', '#ffb8d9', '#ffe184', '#a4ecc4'];
    const s = {
      idleT: 0,
      popped: 0,
      spawnT: 0.2,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      boatProg: 0,
      ripples: [],
      bubbles: [],
      flyers: [],
      basketBounce: 0,
      nextTreatIdx: 0,
    };

    function spawnBubble(W, H, initial = false) {
      const pr = api.playRect(W, H);
      const isTreat = s.bubbles.filter((b) => b.treat).length < 4 && (s.popped + s.bubbles.filter((b) => b.treat).length < 10);
      const treat = isTreat ? TREATS[(s.nextTreatIdx++) % TREATS.length] : null;
      const r = treat ? 30 : 23;
      const x = pr.x + pr.w * (0.28 + Math.random() * 0.44);
      const y = initial ? (pr.y + pr.h * (0.35 + Math.random() * 0.45)) : (pr.y + pr.h * 0.88);
      s.bubbles.push({
        x, y,
        baseX: x,
        r,
        vy: treat ? (36 + Math.random() * 18) : (48 + Math.random() * 24),
        wobPhase: Math.random() * TAU,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
        treat,
        note: Math.floor(Math.random() * 6),
      });
    }

    function layoutPts(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      return {
        pr,
        heroX: pr.x + pr.w * (land ? 0.16 : 0.20),
        heroY: pr.y + pr.h * (land ? 0.78 : 0.84),
        buddyX: pr.x + pr.w * (land ? 0.84 : 0.80),
        buddyY: pr.y + pr.h * (land ? 0.74 : 0.80),
        basketX: pr.x + pr.w * (land ? 0.26 : 0.28),
        basketY: pr.y + pr.h * (land ? 0.80 : 0.86),
        boatX: pr.x + pr.w * 0.50 + Math.sin(s.boatProg * 2) * 14,
        boatY: pr.y + pr.h * (0.72 + Math.sin(s.boatProg) * 0.06),
      };
    }

    function popBubble(b, W, H) {
      const idx = s.bubbles.indexOf(b);
      if (idx >= 0) s.bubbles.splice(idx, 1);
      playSfx('pop');
      playNote(b.note, 0.25);
      api.particles.burst(b.x, b.y, 12, { colors: [b.hue, '#ffffff', '#ffe17a'], speed: 130 });
      s.heroExpr = 'skratt';
      s.heroExprT = 0.8;
      s.heroJump = 0.65;
      if (b.treat && !api.won) {
        const pts = layoutPts(W, H);
        s.flyers.push({
          treat: b.treat,
          ax: b.x, ay: b.y,
          bx: pts.basketX, by: pts.basketY - 10,
          t: 0,
        });
      }
    }

    return {
      _s: s,
      update(dt, W, H) {
        if (s.bubbles.length === 0) {
          for (let i = 0; i < 5; i++) spawnBubble(W, H, true);
        }
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.4);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.4);
        if (s.basketBounce > 0) s.basketBounce = Math.max(0, s.basketBounce - dt * 4);

        s.spawnT -= dt;
        if (s.spawnT <= 0 && s.bubbles.length < 7) {
          spawnBubble(W, H, false);
          s.spawnT = 0.65;
        }

        const pr = api.playRect(W, H);
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          b.y -= b.vy * dt;
          b.x = b.baseX + Math.sin(b.y * 0.03 + b.wobPhase) * 16;
          if (b.y < pr.y + 18) {
            if (b.treat) {
              // Återföds snällt längre ned så inga mål går förlorade
              b.y = pr.y + pr.h * 0.88;
            } else {
              s.bubbles.splice(i, 1);
            }
          }
        }

        for (let i = s.flyers.length - 1; i >= 0; i--) {
          const f = s.flyers[i];
          f.t += dt * 2.4;
          if (f.t >= 1) {
            s.flyers.splice(i, 1);
            s.basketBounce = 1;
            playSfx('pling');
            api.particles.burst(f.bx, f.by, 10, { kind: 'star' });
            if (!api.won) {
              s.popped = Math.min(8, s.popped + 1);
              api.setProgress(s.popped);
              if (s.popped >= 8) {
                s.buddyJump = 1;
                api.win(3);
              }
            }
          }
        }

        for (let i = s.ripples.length - 1; i >= 0; i--) {
          s.ripples[i].t += dt * 1.4;
          if (s.ripples[i].t >= 1) s.ripples.splice(i, 1);
        }
      },

      onDown(x, y, W, H) {
        s.idleT = 0;
        const pts = layoutPts(W, H);

        // 1. Poppa bubblor (generös träffyta!)
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          if (dist(x, y, b.x, b.y) <= b.r + 22) {
            popBubble(b, W, H);
            return;
          }
        }

        // 2. Lövbåt → gungar & plaskar
        if (dist(x, y, pts.boatX, pts.boatY) < 46) {
          s.boatProg += 0.9;
          playSfx('water');
          s.ripples.push({ x: pts.boatX, y: pts.boatY, t: 0 });
          api.particles.burst(pts.boatX, pts.boatY, 10, { colors: ['#92e3ff', '#ffffff', '#9be296'] });
          return;
        }

        // 3. Systrarna → glädjehopp
        if (dist(x, y, pts.heroX, pts.heroY - 42) < 54) {
          s.heroJump = 1;
          s.heroExpr = 'skratt'; s.heroExprT = 0.9;
          playSfx('cheer');
          api.particles.burst(pts.heroX, pts.heroY - 52, 12, { kind: 'heart' });
          return;
        }
        if (dist(x, y, pts.buddyX, pts.buddyY - 42) < 54) {
          s.buddyJump = 1;
          playSfx('pling');
          api.particles.burst(pts.buddyX, pts.buddyY - 52, 12, { kind: 'star' });
          return;
        }

        // 4. Vattenplask i bäcken
        s.ripples.push({ x, y, t: 0 });
        playSfx('water');
        api.particles.burst(x, y, 8, { colors: ['#98e5ff', '#ffffff'], speed: 80, lift: 65 });
      },

      onMove(x, y, W, H) {
        // Svep genom bubblor poppar också direkt!
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          if (dist(x, y, b.x, b.y) <= b.r + 14) {
            popBubble(b, W, H);
            return;
          }
        }
      },

      onUp() {},

      draw(ctx, T, W, H) {
        const pts = layoutPts(W, H);

        // Vattenringar
        ctx.save();
        for (const r of s.ripples) {
          ctx.globalAlpha = (1 - r.t) * 0.7;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, 12 + r.t * 36, 5 + r.t * 15, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();

        // Liten lövbåt som guppar i bäcken
        ctx.save();
        ctx.translate(pts.boatX, pts.boatY + Math.sin(T * 3) * 3);
        ctx.rotate(Math.sin(T * 2.2) * 0.08);
        ctx.fillStyle = '#6db85c';
        ctx.strokeStyle = '#3b6d31';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 11, 0, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff5e0';
        ctx.beginPath();
        ctx.moveTo(0, -3); ctx.lineTo(0, -24); ctx.lineTo(14, -12); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Picknickkorg
        const bSc = 1 + Math.sin(s.basketBounce * Math.PI) * 0.18;
        ctx.save();
        ctx.translate(pts.basketX, pts.basketY);
        ctx.scale(bSc, 2 - bSc);
        drawBasket(ctx, 0, 0, 26, '#f295ad');
        ctx.restore();

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.16;

        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pts.pr.y + pts.pr.h * 0.56, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pts.pr.y + pts.pr.h * 0.56, { ...d2, who: buddyId, scale: heroScale, face: -1 });
        } else {
          drawHero(ctx, T, pts.heroX, pts.heroY, {
            who: leadId,
            scale: heroScale,
            expr: s.idleT > 2.5 ? 'busig' : s.heroExpr,
            pose: s.heroJump > 0 ? 'jump' : 'cheer',
            bob: s.heroJump > 0 ? -Math.sin(s.heroJump * Math.PI) * 28 : 0,
            face: 1,
          });
          drawHero(ctx, T, pts.buddyX, pts.buddyY, {
            who: buddyId,
            scale: heroScale * 0.9,
            expr: s.buddyJump > 0 ? 'skratt' : 'glad',
            pose: s.buddyJump > 0 ? 'jump' : 'idle',
            bob: s.buddyJump > 0 ? -Math.sin(s.buddyJump * Math.PI) * 26 : 0,
            face: -1,
          });
        }

        // Bubblor med skatter inuti
        for (const b of s.bubbles) {
          if (b.treat) {
            drawGlowRing(ctx, T, b.x, b.y, b.r + 4, 'rgba(255, 224, 120, 0.55)');
            blit(ctx, b.treat, b.x, b.y + 18, { h: 34 });
          }
          drawWatercolorBubble(ctx, T, b.x, b.y, b.r, b.hue);
        }

        // Flygande skatter till korgen
        for (const f of s.flyers) {
          const fx = lerp(f.ax, f.bx, f.t);
          const fy = lerp(f.ay, f.by, f.t) - Math.sin(f.t * Math.PI) * 48;
          blit(ctx, f.treat, fx, fy + 16, { h: 36 });
        }

        // Pekhand på första bubblan om man tvekar
        if (!api.won && (s.popped === 0 || s.idleT > 2.6)) {
          const target = s.bubbles.find((b) => b.treat) || s.bubbles[0];
          if (target) drawGuideHand(ctx, T, target.x + 8, target.y + 6);
        }
      },
    };
  },
};
