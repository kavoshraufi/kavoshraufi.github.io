import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawGlowRing, drawGuideHand,
  drawStarPath, playSfx, playNote,
} from '../core.js';

export const level06 = {
  id: 'clouds',
  shortTitle: 'Moln',
  title: 'Molnäventyret',
  art: 'moln',
  bg: 'himmel',
  tint: '#b8dbf0',
  goalTotal: 10,
  rounds: 3,
  goalFor: (r) => 6 + r * 2, // 8, 10, 12
  goalArt: 'stjarna',
  bookDesc: 'Hopp mellan mjuka studsmoln bland himlens glittrande stjärnor!',

  create(api) {
    const G = 6 + (api.round || 1) * 2;
    const FART = 1 + ((api.round || 1) - 1) * 0.14;
    const s = {
      idleT: 0,
      caught: 0,
      heroX: 0,
      heroY: 0,
      vx: 0,
      vy: 0,
      face: 1,
      heroExpr: 'glad',
      heroExprT: 0, buddyJump: 0,
      targetX: null,
      targetY: null,
      inited: false,
      clouds: [
        { rx: 0.22, ry: 0.72, w: 96, sq: 0, rainbow: 0, lift: 0 },
        { rx: 0.52, ry: 0.58, w: 106, sq: 0, rainbow: 0, lift: 0 },
        { rx: 0.80, ry: 0.72, w: 96, sq: 0, rainbow: 0, lift: 0 },
      ],
      stars: [],
      spawnCd: 0.2,
    };

    function spawnStar(W, H, initial = false) {
      const pr = api.playRect(W, H);
      const fromLeft = Math.random() < 0.5;
      const x = initial ? (pr.x + pr.w * (0.2 + Math.random() * 0.6)) : (fromLeft ? pr.x + 12 : pr.x + pr.w - 12);
      const y = pr.y + pr.h * (0.20 + Math.random() * 0.42);
      const speed = (72 + Math.random() * 44) * FART;
      s.stars.push({
        x, y,
        vx: (fromLeft ? 1 : -1) * speed,
        baseY: y,
        phase: Math.random() * TAU,
        kind: Math.random() < 0.28 ? 'berry' : 'star',
        r: 24,
      });
    }

    function drawFluffyCloud(ctx, x, y, w, sq) {
      ctx.save();
      ctx.translate(x, y);
      const sy = 1 - sq * 0.26, sx = 1 + sq * 0.2;
      ctx.scale(sx, sy);
      const puffs = [[-w * 0.25, 2, w * 0.22], [0, -8, w * 0.28], [w * 0.25, 2, w * 0.22]];
      ctx.fillStyle = 'rgba(148, 188, 222, 0.72)';
      for (const [px, py, pr] of puffs) { ctx.beginPath(); ctx.arc(px, py, pr + 2.5, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.roundRect(-w * 0.44, -6, w * 0.88, 27, 13); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
      for (const [px, py, pr] of puffs) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.roundRect(-w * 0.42, -4, w * 0.84, 23, 11); ctx.fill();
      ctx.restore();
    }

    return {
      _s: s,
      update(dt, W, H) {
        const pr = api.playRect(W, H);
        if (!s.inited) {
          s.heroX = pr.x + pr.w * 0.35;
          s.heroY = pr.y + pr.h * 0.62;
          s.vy = -180;
          for (let i = 0; i < 4; i++) spawnStar(W, H, true);
          s.inited = true;
        } else if (s.lastW && (s.lastW !== W || s.lastH !== H)) {
          const oldPr = api.playRect(s.lastW, s.lastH);
          const hrx = clamp((s.heroX - oldPr.x) / Math.max(1, oldPr.w), 0.1, 0.9);
          const hry = clamp((s.heroY - oldPr.y) / Math.max(1, oldPr.h), 0.15, 0.85);
          s.heroX = pr.x + pr.w * hrx;
          s.heroY = pr.y + pr.h * hry;
          for (const st of s.stars) {
            const rx = clamp((st.x - oldPr.x) / Math.max(1, oldPr.w), 0.08, 0.92);
            const ry = clamp((st.baseY - oldPr.y) / Math.max(1, oldPr.h), 0.18, 0.64);
            st.x = pr.x + pr.w * rx;
            st.baseY = pr.y + pr.h * ry;
            st.y = st.baseY + Math.sin(st.phase) * 16;
          }
        }
        s.lastW = W; s.lastH = H;
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.4);
        for (const c of s.clouds) {
          c.x = pr.x + pr.w * c.rx;
          if (c.lift > 0) c.lift = Math.max(0, c.lift - dt * 1.5);
          c.y = pr.y + pr.h * c.ry - Math.sin(c.lift * Math.PI) * 18;
          if (c.sq > 0) c.sq = Math.max(0, c.sq - dt * 4);
          if (c.rainbow > 0) c.rainbow = Math.max(0, c.rainbow - dt * 1.4);
        }

        // Fysik för mjuk fjädrande flygning
        if (s.targetX !== null) {
          const dx = s.targetX - s.heroX;
          s.vx = clamp(dx * 5.2, -320, 320);
          if (Math.abs(dx) > 6) s.face = dx >= 0 ? 1 : -1;
        } else {
          s.vx *= Math.pow(0.08, dt);
        }
        s.vy += 460 * dt; // lätt sagogravitation
        s.heroX = clamp(s.heroX + s.vx * dt, pr.x + 30, pr.x + pr.w - 30);
        s.heroY += s.vy * dt;

        // Studs på moln
        for (const c of s.clouds) {
          if (s.vy > 0 && Math.abs(s.heroX - c.x) < c.w * 0.56 && Math.abs(s.heroY - c.y) < 22) {
            s.heroY = c.y - 6;
            s.vy = -310;
            c.sq = 1;
            playSfx('jump');
            api.particles.burst(s.heroX, c.y, 7, { colors: ['#ffffff', '#cceeff'], speed: 70 });
          }
        }

        // Varm uppvind i botten så man aldrig ramlar ned!
        const floorY = pr.y + pr.h * 0.88;
        if (s.heroY > floorY) {
          s.heroY = floorY;
          s.vy = -340;
          playSfx('whoosh');
          api.particles.burst(s.heroX, floorY, 8, { colors: ['#ffffff', '#ffe8a8'], speed: 80 });
        }
        if (s.heroY < pr.y + 42) {
          s.heroY = pr.y + 42;
          s.vy = Math.max(0, s.vy);
        }

        // Spawna & flytta stjärnor
        s.spawnCd -= dt;
        if (s.spawnCd <= 0 && s.stars.length < 5 && !api.won) {
          spawnStar(W, H, false);
          s.spawnCd = 0.75;
        }

        for (let i = s.stars.length - 1; i >= 0; i--) {
          const st = s.stars[i];
          st.x += st.vx * dt;
          st.phase += dt * 3;
          st.y = st.baseY + Math.sin(st.phase) * 16;

          // Fånga med systern
          if (dist(s.heroX, s.heroY - 38, st.x, st.y) < 58) {
            s.stars.splice(i, 1);
            playSfx('star');
            playNote(s.caught % 6, 0.3);
            s.heroExpr = 'skratt';
            s.heroExprT = 0.7;
            api.particles.burst(st.x, st.y, 16, { kind: 'star', colors: ['#ffe272', '#fff7ba', '#ff9ec4'] });
            if (!api.won) {
              s.caught = Math.min(G, s.caught + 1);
              api.setProgress(s.caught);
              if (s.caught >= G) api.win(3);
            }
            continue;
          }
          if (st.x < pr.x + 8 || st.x > pr.x + pr.w - 8) {
            st.vx = -st.vx; // studsa snällt inom skärmen så inget försvinner!
            st.x = clamp(st.x, pr.x + 10, pr.x + pr.w - 10);
          }
        }
      },

      onDown(x, y, W, H) {
        s.idleT = 0;
        const pr = api.playRect(W, H);
        // Andra systern på sidomolnet hejar & kastar stjärnglitter
        const bx = pr.x + pr.w * 0.88, by = pr.y + pr.h * 0.42;
        if (!api.won && dist(x, y, bx, by - 36) < 48) {
          s.buddyJump = 1;
          playSfx('cheer');
          api.particles.burst(bx, by - 46, 14, { kind: 'star', colors: ['#ffe272', '#ff9ec4', '#88dbff'] });
          return;
        }
        // Tryck på ett studsmoln → regnbågspuff som skickar systern högt!
        for (let ci = 0; ci < s.clouds.length; ci++) {
          const c = s.clouds[ci];
          if (Math.abs(x - c.x) < c.w * 0.5 && Math.abs(y - c.y) < 30) {
            c.sq = 1; c.rainbow = 1; c.lift = 1;
            for (const st of s.stars) if (dist(st.x, st.y, c.x, c.y) < 180) st.baseY = lerp(st.baseY, c.y - 48, 0.3);
            s.targetX = c.x;
            s.vy = -360;
            playSfx('whoosh');
            playNote(ci * 2, 0.3);
            api.particles.burst(c.x, c.y - 10, 14, { kind: 'star', colors: ['#ff9ec4', '#ffe272', '#88dbff', '#9be296'] });
            return;
          }
        }
        s.targetX = x;
        s.targetY = y;
        // Direkt hopp mot dit man trycker (och direktfångst om man duttar på stjärnan!)
        s.vy = y < s.heroY ? -320 : -220;
        playSfx('jump');
        api.particles.burst(x, y, 6, { colors: ['#ffffff', '#ffe89c'], speed: 60 });
        for (let i = s.stars.length - 1; i >= 0; i--) {
          const st = s.stars[i];
          if (dist(x, y, st.x, st.y) < 42) {
            // Flyg snabbt rakt till stjärnan!
            s.heroX = lerp(s.heroX, st.x, 0.65);
            s.heroY = lerp(s.heroY, st.y + 18, 0.65);
          }
        }
      },

      onMove(x, y) {
        if (s.targetX !== null) {
          s.targetX = x;
          s.targetY = y;
        }
      },

      onUp() {
        s.targetX = null;
        s.targetY = null;
      },

      draw(ctx, T, W, H) {
        const pr = api.playRect(W, H);
        // Regnbåge i himlen som målas band för band av fångade stjärnor!
        const bands = Math.min(6, Math.ceil((s.caught / Math.max(1, G)) * 6));
        if (bands > 0) {
          const cols = ['#ff8fab', '#ffb36b', '#ffe272', '#8ce09a', '#80d0ff', '#b99cff'];
          ctx.save();
          for (let b = 0; b < bands; b++) {
            ctx.strokeStyle = cols[b];
            ctx.globalAlpha = 0.38;
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.arc(pr.x + pr.w * 0.5, pr.y + pr.h * 0.96, pr.w * 0.42 - b * 9, Math.PI * 1.08, Math.PI * 1.92);
            ctx.stroke();
          }
          ctx.restore();
        }
        // Studsmoln
        for (const c of s.clouds) {
          if (c.rainbow > 0) drawGlowRing(ctx, T, c.x, c.y, c.w * 0.5, `rgba(255, 224, 150, ${c.rainbow * 0.65})`);
          drawFluffyCloud(ctx, c.x, c.y, c.w, c.sq);
        }

        // Stjärnor & bärballonger
        for (const st of s.stars) {
          if (!api.won && st.x > 30 && st.x < W - 30) drawGlowRing(ctx, T, st.x, st.y, 26, 'rgba(255, 224, 112, 0.65)');
          if (st.kind === 'berry') {
            blit(ctx, 'berry', st.x, st.y + 18, { h: 36 });
          } else {
            ctx.save();
            ctx.translate(st.x, st.y);
            ctx.rotate(Math.sin(T * 3 + st.phase) * 0.16);
            ctx.fillStyle = '#ffe05a';
            ctx.strokeStyle = '#c4831a';
            ctx.lineWidth = 2;
            drawStarPath(ctx, 5, 20, 9);
            ctx.fill(); ctx.stroke();
            ctx.restore();
          }
        }

        // Systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.15;

        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.62, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.62, { ...d2, who: buddyId, scale: heroScale, face: -1 });
        } else {
          // Andra systern svävar glatt på sidomolnet och hejar!
          drawHero(ctx, T, pr.x + pr.w * 0.88, pr.y + pr.h * 0.42 + Math.sin(T * 2.6) * 8 - Math.sin(s.buddyJump * Math.PI) * 24, {
            who: buddyId, scale: heroScale * 0.82, expr: 'skratt', pose: 'cheer', face: -1,
          });
          drawHero(ctx, T, s.heroX, s.heroY, {
            who: leadId, scale: heroScale,
            expr: s.vy < -80 ? 'skratt' : s.heroExpr,
            pose: s.vy < -40 ? 'jump' : 'idle',
            face: s.face,
          });
        }

        // Pekhand mot närmaste stjärna
        if (!api.won && (s.caught === 0 || s.idleT > 2.6) && s.stars[0]) {
          drawGuideHand(ctx, T, s.stars[0].x + 8, s.stars[0].y + 8);
        }
      },
    };
  },
};
