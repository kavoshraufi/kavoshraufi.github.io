import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawWatercolorBubble, drawBasket, playSfx, playNote,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level02 = {
  id: 'brook',
  shortTitle: 'Bäck',
  title: 'Bäckplask',
  art: 'bubbla',
  bg: 'back',
  tint: '#b8d7cd',
  goalTotal: 6,
  rounds: 4,
  goalFor: (r) => 4 + r, // 5, 6, 7, 8 godisbubblor
  goalArt: 'bubbla',
  bookDesc: 'Regnbågsbubblor och lövbåtar vid den klara skogsbäcken!',

  create(api) {
    const G = 4 + (api.round || 1);
    const FART = 1 + ((api.round || 1) - 1) * 0.12;
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
      boatProg: 0, boatWaveT: 0, ambT: 0, cargo: null, stones: [{ rx: 0.34, ry: 0.85, note: 0, pop: 0 }, { rx: 0.50, ry: 0.87, note: 2, pop: 0 }, { rx: 0.66, ry: 0.85, note: 4, pop: 0 }],
      ripples: [],
      bubbles: [],
      flyers: [],
      basketBounce: 0,
      nextTreatIdx: 0,
      stage: createHeroStage(),
    };

    function spawnBubble(W, H, initial = false) {
      const pr = api.playRect(W, H);
      const isTreat = s.bubbles.filter((b) => b.treat).length < 4 && (s.popped + s.bubbles.filter((b) => b.treat).length < G + 2);
      const treat = isTreat ? TREATS[(s.nextTreatIdx++) % TREATS.length] : null;
      const r = treat ? 30 : 23;
      const x = pr.x + pr.w * (0.28 + Math.random() * 0.44);
      const y = initial ? (pr.y + pr.h * (0.30 + Math.random() * 0.42)) : (pr.y + pr.h * 0.82);
      s.bubbles.push({
        x, y,
        baseX: x,
        r,
        vy: (treat ? (36 + Math.random() * 18) : (48 + Math.random() * 24)) * FART,
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
        heroX: pr.x + pr.w * (land ? 0.14 : 0.18),
        heroY: pr.y + pr.h * (land ? 0.89 : 0.91),
        buddyX: pr.x + pr.w * (land ? 0.86 : 0.82),
        buddyY: pr.y + pr.h * (land ? 0.89 : 0.91),
        basketX: pr.x + pr.w * (land ? 0.25 : 0.30),
        basketY: pr.y + pr.h * (land ? 0.89 : 0.91),
        boatX: pr.x + pr.w * (0.38 + 0.34 * clamp(s.popped / G, 0, 1)) + Math.sin(s.boatProg * 2) * 10,
        boatY: pr.y + pr.h * (0.71 + Math.sin(s.boatProg) * 0.04),
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
      reactHeroStage(s.stage, 'lead', 'skratt', 0.65);
      if (b.treat && !api.won) {
        s.boatProg += 0.45;
        s.boatWaveT = 0.7;
        s.cargo = b.treat;
        const pts = layoutPts(W, H);
        s.flyers.push({
          treat: b.treat,
          ax: b.x, ay: b.y,
          bx: pts.basketX, by: pts.basketY - 10,
          t: 0,
        });
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * (W >= H ? 0.89 : 0.91);
    }
    function standPoints(W, H) {
      const pts = layoutPts(W, H);
      const gy = groundY(W, H);
      return {
        lead: [pts.heroX, gy],
        buddy: [pts.buddyX, gy],
        winLead: [pts.pr.x + pts.pr.w * 0.29, gy],
        winBuddy: [pts.pr.x + pts.pr.w * 0.74, gy],
        leadFace: 1, buddyFace: -1,
      };
    }

    return {
      _s: s,
      groundY,
      standPoints,
      update(dt, W, H) {
        if (s.bubbles.length === 0) {
          for (let i = 0; i < 5; i++) spawnBubble(W, H, true);
        }
        s.idleT += dt;
        s.ambT += dt;
        if (!api.won && s.ambT > 2.3) {
          s.ambT = 0;
          const pts = layoutPts(W, H);
          s.ripples.push({ x: pts.boatX, y: pts.boatY, t: 0 });
          api.particles.burst(pts.boatX + (Math.random() - 0.5) * 50, pts.boatY, 5, { colors: ['#9be5ff', '#ffffff', '#ffe89c'], speed: 45, lift: 55 });
        }
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.4);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.4);
        if (s.basketBounce > 0) s.basketBounce = Math.max(0, s.basketBounce - dt * 4);
        if (s.boatWaveT > 0) s.boatWaveT = Math.max(0, s.boatWaveT - dt * 1.6);
        for (const st of s.stones) if (st.pop > 0) st.pop = Math.max(0, st.pop - dt * 3.5);

        s.spawnT -= dt;
        if (s.spawnT <= 0 && s.bubbles.length < 7) {
          spawnBubble(W, H, false);
          s.spawnT = 0.65;
        }

        const pr = api.playRect(W, H);
        if (s.lastW && (s.lastW !== W || s.lastH !== H)) {
          const oldPr = api.playRect(s.lastW, s.lastH);
          for (const b of s.bubbles) {
            const rx = clamp((b.baseX - oldPr.x) / Math.max(1, oldPr.w), 0.18, 0.82);
            const ry = clamp((b.y - oldPr.y) / Math.max(1, oldPr.h), 0.15, 0.82);
            b.baseX = pr.x + pr.w * rx;
            b.y = pr.y + pr.h * ry;
            b.x = b.baseX + Math.sin(b.y * 0.03 + b.wobPhase) * 16;
          }
          const pts = layoutPts(W, H);
          for (const f of s.flyers) { f.bx = pts.basketX; f.by = pts.basketY - 10; }
        }
        s.lastW = W; s.lastH = H;
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          b.y -= b.vy * dt;
          b.x = b.baseX + Math.sin(b.y * 0.03 + b.wobPhase) * 16;
          if (b.y < pr.y + 40) {
            if (b.treat) {
              // Återföds snällt längre ned så inga mål går förlorade
              b.y = pr.y + pr.h * 0.82;
            } else {
              s.bubbles.splice(i, 1);
            }
          }
        }

        for (let i = s.flyers.length - 1; i >= 0; i--) {
          const f = s.flyers[i];
          f.t += dt * 1.55;
          const u = Math.min(1, f.t);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          const fx = lerp(f.ax, f.bx, e);
          const fy = lerp(f.ay, f.by, e) - Math.sin(e * Math.PI) * 86;
          if (Math.random() < 0.65) {
            api.particles.burst(fx, fy, 1, { colors: ["#ffe272", "#fff6cc", "#ff9ec4"], speed: 24, size: 3 });
          }
          if (f.t >= 1) {
            s.flyers.splice(i, 1);
            s.basketBounce = 1;
            playSfx('pling');
            api.particles.burst(f.bx, f.by, 10, { kind: 'star' });
            if (!api.won) {
              s.popped = Math.min(G, s.popped + 1);
              api.setProgress(s.popped);
              if (s.popped >= G) {
                s.buddyJump = 1;
                reactHeroStage(s.stage, 'both', 'skratt', 0.9);
                api.win(3);
              }
            }
          }
        }

        for (let i = s.ripples.length - 1; i >= 0; i--) {
          s.ripples[i].t += dt * 1.4;
          if (s.ripples[i].t >= 1) s.ripples.splice(i, 1);
        }
        updateHeroStage(s.stage, dt, { won: api.levelWon, pts: standPoints(W, H) });
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

        // 2. Lövbåt → seglar med vindvåg, sjunger & poppar en bubbla i närheten!
        if (dist(x, y, pts.boatX, pts.boatY) < 50) {
          s.boatProg += 0.9;
          s.boatWaveT = 1;
          playSfx('water');
          playNote(3, 0.28);
          s.ripples.push({ x: pts.boatX, y: pts.boatY, t: 0 });
          api.particles.burst(pts.boatX, pts.boatY - 8, 12, { colors: ['#92e3ff', '#ffffff', '#9be296'] });
          const near = s.bubbles.find((b) => dist(b.x, b.y, pts.boatX, pts.boatY) < 120);
          if (near) popBubble(near, W, H);
          return;
        }

        // 2b. Hoppstenar i bäcken → plask & xylofontoner!
        for (const st of s.stones) {
          const sx = pts.pr.x + pts.pr.w * st.rx;
          const sy = pts.pr.y + pts.pr.h * st.ry;
          if (dist(x, y, sx, sy) < 34) {
            st.pop = 1;
            playNote(st.note, 0.34);
            s.ripples.push({ x: sx, y: sy, t: 0 });
            api.particles.burst(sx, sy - 8, 10, { colors: ['#9be5ff', '#ffffff', '#ffe17a'] });
            return;
          }
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
        // Svep i bäcken skapar strömvirvlar som styr bubblor & poppar!
        if (Math.random() < 0.25) s.ripples.push({ x, y, t: 0.25 });
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          const dd = dist(x, y, b.x, b.y);
          if (dd <= b.r + 16) {
            popBubble(b, W, H);
            return;
          }
          if (dd < 110) b.baseX = lerp(b.baseX, x, 0.08);
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

        // Målade näckrosblad i bäcken som spelar toner
        for (let idx = 0; idx < s.stones.length; idx++) {
          const st = s.stones[idx];
          const sx = pts.pr.x + pts.pr.w * st.rx;
          const sy = pts.pr.y + pts.pr.h * st.ry - Math.sin(st.pop * Math.PI) * 8 + Math.sin(T * 2 + idx) * 1.5;
          ctx.save();
          ctx.translate(sx, sy);
          // Vattenskugga under näckrosbladet
          ctx.fillStyle = 'rgba(32, 74, 68, 0.22)';
          ctx.beginPath(); ctx.ellipse(2, 4, 24, 12, 0, 0, TAU); ctx.fill();
          // Näckrosblad med flik (akvarellton)
          const lg = ctx.createRadialGradient(-4, -3, 2, 0, 0, 24);
          lg.addColorStop(0, '#9dd886');
          lg.addColorStop(0.65, '#69b05d');
          lg.addColorStop(1, '#488749');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.ellipse(0, 0, 23, 12, 0, 0.28 + idx * 0.4, TAU - 0.18 + idx * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 98, 52, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // Bladnerver
          ctx.strokeStyle = 'rgba(210, 244, 186, 0.45)';
          ctx.lineWidth = 1;
          for (let v = -1; v <= 1; v++) {
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(v * 11 - 6, v * 5 - 2); ctx.stroke();
          }
          // Liten rosa näckrosblomma på mittersta bladet
          if (idx === 1) {
            for (let p = 0; p < 5; p++) {
              const a = (p / 5) * TAU + 0.2;
              ctx.fillStyle = 'rgba(255, 204, 222, 0.92)';
              ctx.beginPath(); ctx.ellipse(Math.cos(a) * 5, -3 + Math.sin(a) * 3, 4.5, 2.8, a, 0, TAU); ctx.fill();
            }
            ctx.fillStyle = '#ffe072';
            ctx.beginPath(); ctx.arc(0, -3, 2.6, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }

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
        if (s.cargo) {
          blit(ctx, s.cargo, pts.boatX - 10, pts.boatY + 6 + Math.sin(T * 3) * 3, { h: 24 });
        }

        // Picknickkorg med varm glöd när skatter flyger in
        const bSc = 1 + Math.sin(s.basketBounce * Math.PI) * 0.18;
        if (s.flyers.length > 0) drawGlowRing(ctx, T, pts.basketX, pts.basketY - 6, 42, 'rgba(255, 226, 130, 0.72)');
        ctx.save();
        ctx.translate(pts.basketX, pts.basketY);
        ctx.scale(bSc, 2 - bSc);
        drawBasket(ctx, 0, 0, 33, '#f295ad');
        ctx.restore();

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.16;

        if (!api.levelWon) {
          s.stage.lead.jump = Math.max(s.stage.lead.jump, s.heroJump);
          s.stage.buddy.jump = Math.max(s.stage.buddy.jump, s.buddyJump);
          if (s.idleT > 2.5) s.stage.lead.expr = 'busig';
        }
        drawHeroStage(ctx, T, s.stage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon, leadPose: 'idle', buddyPose: 'idle',
        });

        // Bubblor med skatter inuti
        for (const b of s.bubbles) {
          if (b.treat) {
            if (!api.won) drawGlowRing(ctx, T, b.x, b.y, b.r + 4, 'rgba(255, 224, 120, 0.55)');
            blit(ctx, b.treat, b.x, b.y + 18, { h: 34 });
          }
          drawWatercolorBubble(ctx, T, b.x, b.y, b.r, b.hue);
        }

        // Flygande skatter bågar magnetiskt ned i picknickkorgen
        for (const f of s.flyers) {
          const u = Math.min(1, f.t);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          const fx = lerp(f.ax, f.bx, e);
          const fy = lerp(f.ay, f.by, e) - Math.sin(e * Math.PI) * 86;
          drawGlowRing(ctx, T, fx, fy, 22, 'rgba(255, 228, 128, 0.7)');
          blit(ctx, f.treat, fx, fy + 14, { h: 34 * (1 - u * 0.25) });
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
