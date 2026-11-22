import {
  TAU, clamp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawStarPath, playSfx, playNote, drawIkon,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level09 = {
  id: 'treasure',
  shortTitle: 'Skatt',
  title: 'Skattjakten',
  art: 'nyckel',
  bg: 'borggard',
  tint: '#d9ccb2',
  goalTotal: 3,
  rounds: 3,
  goalArt: 'nyckel',
  bookDesc: 'Rävungens tassspår ledde till tre nycklar — krona, nalle och klocka!',

  create(api) {
    // 1.9: ny kärnverb — FÖLJ TASSPÅREN. Rävungen har lekt gömma med systrarnas nycklar:
    // tryck på tassavtrycken ett i taget, gräv där spåret tar slut, och nyckeln hoppar själv till sin kista.
    const R = api.round || 1;
    const SPAR = R === 1 ? 3 : R === 2 ? 4 : 5;      // avtryck per spår
    const GRAV = R >= 3 ? 3 : 2;                      // grävtryck
    const ORDNING = [[0, 1, 2], [2, 0, 1], [1, 2, 0]][(R - 1) % 3];
    const s = {
      idleT: 0,
      opened: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      cur: 0,          // index i ORDNING
      step: 0,         // nästa avtryck att trycka på
      dug: 0,          // grävtryck hittills
      flyT: 0,         // nyckeln flyger till kistan
      foxT: 0,         // rävungen tittar upp ur gropen
      puffs: [], clods: [], digShake: 0, stage: createHeroStage(),
      trail: [],
      pairs: [
        { id: 'circle', chestSprite: 'chest-circle', color: '#f08b49', toy: 'krona', open: false, cx: 0, cy: 0, dx: 0, dy: 0, popT: 0 },
        { id: 'tri', chestSprite: 'chest-tri', color: '#58b878', toy: 'nalle', open: false, cx: 0, cy: 0, dx: 0, dy: 0, popT: 0 },
        { id: 'star', chestSprite: 'chest-star', color: '#f3c63f', toy: 'klocka', open: false, cx: 0, cy: 0, dx: 0, dy: 0, popT: 0 },
      ],
    };
    const target = () => s.pairs[ORDNING[s.cur]];

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      const chestXs = land ? [0.31, 0.52, 0.73] : [0.23, 0.50, 0.77];
      const chestY = pr.y + pr.h * (land ? 0.47 : 0.41);
      const digXs = land ? [0.24, 0.50, 0.76] : [0.24, 0.50, 0.76];
      const digY = pr.y + pr.h * (land ? 0.66 : 0.62);
      s.pairs.forEach((p, i) => {
        p.cx = pr.x + pr.w * chestXs[i];
        p.cy = chestY;
        p.dx = pr.x + pr.w * digXs[(i + R) % 3];
        p.dy = digY + ((i + R) % 2) * pr.h * 0.06;
      });
      // Spåret slingrar från förra grävplatsen (eller mitten nere) fram till nästa grävplats
      const t = target();
      if (t) {
        const prev = s.cur > 0 ? s.pairs[ORDNING[s.cur - 1]] : null;
        const sx = prev ? prev.dx : pr.x + pr.w * 0.16;
        const sy = prev ? prev.dy : pr.y + pr.h * 0.62;
        s.trail = [];
        for (let k = 1; k <= SPAR; k++) {
          const f = k / (SPAR + 1);
          const wig = Math.sin(f * Math.PI * 2 + s.cur) * pr.w * 0.06;
          const x = sx + (t.dx - sx) * f + wig;
          const y = sy + (t.dy - sy) * f + Math.sin(f * Math.PI) * pr.h * 0.1;
          s.trail.push({ x: clamp(x, pr.x + 40, pr.x + pr.w - 40), y: clamp(y, pr.y + pr.h * 0.52, pr.y + pr.h * 0.8), rot: Math.atan2(t.dy - sy, t.dx - sx) + Math.PI / 2 + (k % 2 ? 0.25 : -0.25) });
        }
      }
      s.heroPos = [pr.x + pr.w * (land ? 0.10 : 0.18), pr.y + pr.h * 0.89];
      s.buddyPos = [pr.x + pr.w * (land ? 0.90 : 0.82), pr.y + pr.h * 0.89];
      return pr;
    }

    function drawShapeIcon(ctx, id, x, y, r, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#5a3d1c';
      ctx.lineWidth = 2;
      if (id === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      } else if (id === 'tri') {
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.1);
        ctx.lineTo(r * 1.05, r * 0.85);
        ctx.lineTo(-r * 1.05, r * 0.85);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        drawStarPath(ctx, 5, r * 1.2, r * 0.55);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    function drawShapeKey(ctx, p, x, y, sc = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#5c3c18';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.roundRect(-2, -4, 24, 8, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(14, 2, 5, 8, 2); ctx.fill(); ctx.stroke();
      drawShapeIcon(ctx, p.id, -10, 0, 11, p.color);
      ctx.restore();
    }

    function openChest(p) {
      if (p.open) return;
      p.open = true;
      p.popT = 1;
      s.opened++;
      playSfx('open');
      playNote(s.opened * 2 - 1, 0.38);
      s.heroExpr = 'skratt';
      s.heroExprT = 1.1;
      s.heroJump = 1;
      s.buddyJump = 0.9;
      api.particles.burst(p.cx, p.cy - 24, 18, { kind: 'star', colors: [p.color, '#ffe17a', '#ffffff'] });
      api.setProgress(s.opened);
      s.cur++; s.step = 0; s.dug = 0;
      if (s.opened >= s.pairs.length) { reactHeroStage(s.stage, 'both', 'skratt', 0.9); api.win(); }
    }

    function puff(x, y, digBurst = false) {
      s.puffs.push({ x, y, t: 0.5 });
      api.particles.burst(x, y, digBurst ? 10 : 6, { colors: ['#e7d3a8', '#cdb58a', '#8a6a3a', '#ffffff'], speed: digBurst ? 95 : 60, lift: 45 });
      if (digBurst) {
        s.digShake = 1;
        for (let k = 0; k < 8; k++) {
          const ang = -Math.PI * (0.18 + Math.random() * 0.64);
          const spd = 95 + Math.random() * 115;
          s.clods.push({
            x: x + (Math.random() - 0.5) * 18,
            y: y - 4,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 40,
            r: 3.5 + Math.random() * 3.5,
            col: k % 2 ? '#b88d50' : '#8a6534',
            t: 0.65,
          });
        }
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * 0.89;
    }
    function standPoints(W, H) {
      layout(W, H);
      const gy = groundY(W, H);
      return {
        lead: [s.heroPos[0], gy],
        buddy: [s.buddyPos[0], gy],
        winLead: [W * 0.34, gy],
        winBuddy: [W * 0.66, gy],
        leadFace: 1, buddyFace: -1,
      };
    }

    return {
      _s: s,
      groundY,
      standPoints,
      update(dt, W, H) {
        layout(W, H);
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.4);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.4);
        if (s.foxT > 0) s.foxT = Math.max(0, s.foxT - dt * 0.7);
        for (const p of s.pairs) if (p.popT > 0) p.popT = Math.max(0, p.popT - dt * 2.5);
        if (s.digShake > 0) s.digShake = Math.max(0, s.digShake - dt * 4);
        for (const f of s.puffs) f.t -= dt;
        s.puffs = s.puffs.filter((f) => f.t > 0);
        for (const c of s.clods) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 420 * dt; c.t -= dt; }
        s.clods = s.clods.filter((c) => c.t > 0);
        if (s.flyT > 0) {
          s.flyT = Math.max(0, s.flyT - dt * 1.65);
          if (s.flyT === 0) openChest(target());
        }
        updateHeroStage(s.stage, dt, { won: api.levelWon, pts: standPoints(W, H) });
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;
        const t = target();

        if (t && s.flyT === 0) {
          // 1. Nästa tassavtryck
          const nxt = s.trail[s.step];
          if (nxt && dist(x, y, nxt.x, nxt.y) < 36) {
            s.step++;
            playNote(s.step % 6, 0.28);
            api.particles.burst(nxt.x, nxt.y, 8, { kind: 'star', colors: ['#ffe17a', '#ffffff', '#ffc38a'] });
            s.heroExpr = 'forvanad'; s.heroExprT = 0.5;
            s.foxT = Math.max(s.foxT, 0.45);
            return;
          }
          // 2. Gräv där spåret slutar
          if (s.step >= s.trail.length && dist(x, y, t.dx, t.dy - 10) < 44) {
            s.dug++;
            playSfx('plant');
            puff(t.dx, t.dy - 6, true);
            if (s.dug >= GRAV) {
              playSfx('star');
              s.flyT = 1.35;
              s.foxT = 1;
              s.heroJump = 0.6;
              api.particles.burst(t.dx, t.dy - 14, 16, { kind: 'star', colors: ['#ffe17a', '#ffffff', t.color] });
            }
            return;
          }
          // Ett avtryck längre fram: snällt — visa var spåret fortsätter
          const later = s.trail.findIndex((p, i) => i > s.step && dist(x, y, p.x, p.y) < 36);
          if (later >= 0) {
            playSfx('softno');
            const n2 = s.trail[s.step];
            api.particles.burst(n2.x, n2.y, 6, { kind: 'star' });
            return;
          }
        }

        // 3. Öppna kistor: leksaken skuttar och spelar
        for (const p of s.pairs) {
          if (dist(x, y, p.cx, p.cy - 22) < 50) {
            p.popT = 1;
            if (p.open) {
              playNote(s.pairs.indexOf(p) * 2, 0.35);
              api.particles.burst(p.cx, p.cy - 60, 10, { kind: 'star' });
            } else {
              playSfx('softno');
              playNote(0, 0.22);
              api.particles.burst(p.cx, p.cy - 30, 8, { colors: [p.color, '#ffe17a'] });
            }
            return;
          }
        }

        // 4. Systrarna
        if (s.heroPos && dist(x, y, s.heroPos[0], s.heroPos[1] - 42) < 52) {
          s.heroJump = 1; s.heroExpr = 'skratt'; s.heroExprT = 0.9;
          playSfx('cheer');
          api.particles.burst(s.heroPos[0], s.heroPos[1] - 54, 12, { kind: 'heart' });
          return;
        }
        if (s.buddyPos && dist(x, y, s.buddyPos[0], s.buddyPos[1] - 42) < 52) {
          s.buddyJump = 1;
          playSfx('pling');
          api.particles.burst(s.buddyPos[0], s.buddyPos[1] - 54, 12, { kind: 'star' });
          return;
        }

        // 4b. Fontänen i borggården plaskar och glittrar!
        const pr = layout(W, H);
        if (dist(x, y, pr.x + pr.w * 0.62, pr.y + pr.h * 0.30) < 52) {
          playSfx('water');
          playNote(4, 0.25);
          api.particles.burst(x, y, 14, { colors: ['#88dcff', '#ffffff', '#cfeaff'], lift: 85 });
          return;
        }
        // 4c. Rosbuskarna vid murarna prasslar blomblad!
        if (dist(x, y, pr.x + pr.w * 0.14, pr.y + pr.h * 0.28) < 48 || dist(x, y, pr.x + pr.w * 0.86, pr.y + pr.h * 0.28) < 48) {
          playSfx('plant');
          api.particles.burst(x, y, 12, { kind: 'heart', colors: ['#ff9ec4', '#ffe17a', '#9be296'] });
          return;
        }

        // 5. Sanden & borggårdens stenar klingar mjukt där man trycker
        if (y < pr.y + pr.h * 0.38) {
          playSfx('bird');
          playNote(5, 0.24);
          api.particles.burst(x, y, 8, { kind: 'star', colors: ['#ffe17a', '#ffffff'] });
        } else {
          playNote(Math.floor((x / Math.max(1, W)) * 6) % 6, 0.24);
          puff(x, y);
        }
      },

      onMove() {},
      onUp() {},

      draw(ctx, T, W, H) {
        const pr = layout(W, H);
        const t = target();

        // Kistor
        for (const p of s.pairs) {
          if (!p.open && t === p) drawGlowRing(ctx, T, p.cx, p.cy - 30, 44, p.color);
          drawShadow(ctx, p.cx, p.cy + 4, 30, 8);
          const sq = 1 + Math.sin(p.popT * Math.PI) * 0.12;
          blit(ctx, p.open ? 'chest-open' : p.chestSprite, p.cx, p.cy, { h: 70 * sq });
          if (!p.open) {
            drawShapeIcon(ctx, p.id, p.cx, p.cy - 62, 11, p.color);
          } else {
            const hop = Math.sin(T * 3.5 + p.cx) * 5 - Math.sin(p.popT * Math.PI) * 16;
            drawIkon(ctx, p.toy, p.cx, p.cy - 64 + hop, 36);
          }
        }

        // Grävplatsen (sandhög) + spåret dit
        if (t) {
          ctx.save();
          ctx.translate(t.dx, t.dy);
          const ready = s.step >= s.trail.length && s.flyT === 0;
          if (ready) drawGlowRing(ctx, T, 0, -10, 34, 'rgba(255, 214, 102, 0.8)');
          drawShadow(ctx, 0, 4, 30, 8);
          const shk = Math.sin(s.digShake * Math.PI) * 0.14;
          ctx.scale(1 + shk, 1 - shk * 0.7);
          const h = Math.max(5, 22 - s.dug * 5.5);
          if (s.dug > 0) {
            ctx.fillStyle = '#6b4b26';
            ctx.beginPath(); ctx.ellipse(0, 2, 16 + s.dug * 3, 6 + s.dug * 1.4, 0, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = '#d9b77c'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, 0, 30, h, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#c49c5e';
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-16 + k * 11, -h * 0.4, 3, 0, TAU); ctx.fill(); }
          ctx.restore();
          s.trail.forEach((p, i) => {
            if (i < s.step) {
              ctx.save(); ctx.globalAlpha = 0.35; drawIkon(ctx, 'tass', p.x, p.y, 26, { rot: p.rot, noTrack: true }); ctx.restore();
              return;
            }
            const isNext = i === s.step;
            if (isNext) drawGlowRing(ctx, T, p.x, p.y, 24, 'rgba(255, 210, 120, 0.85)');
            const pulse = isNext ? 1 + Math.sin(T * 6) * 0.08 : 1;
            ctx.save(); ctx.globalAlpha = isNext ? 1 : 0.6;
            drawIkon(ctx, 'tass', p.x, p.y, 30 * pulse, { rot: p.rot });
            ctx.restore();
          });
        }

        // Nyckeln poppar upp ur gropen (1.35 -> 0.95) och flyger sedan i båge till kistan (0.95 -> 0)
        if (t && s.flyT > 0) {
          if (s.flyT > 0.95) {
            const pop = 1 - (s.flyT - 0.95) / 0.40;
            const ky = t.dy - 4 - Math.sin(pop * Math.PI * 0.65) * 42;
            drawGlowRing(ctx, T, t.dx, ky, 26, 'rgba(255, 232, 120, 0.85)');
            blit(ctx, 'key', t.dx, ky + 14, { h: 42 * (0.65 + 0.45 * pop), rot: Math.sin(pop * 12) * 0.25 });
          } else {
            const k = 1 - s.flyT / 0.95;
            const kx = t.dx + (t.cx - t.dx) * k;
            const ky = t.dy - 36 + (t.cy - 40 - (t.dy - 36)) * k - Math.sin(k * Math.PI) * 64;
            blit(ctx, 'key', kx, ky + 20, { h: 40, rot: k * 6 });
          }
        }
        for (const c of s.clods) {
          ctx.save();
          ctx.globalAlpha = clamp(c.t / 0.35, 0, 1);
          ctx.fillStyle = c.col;
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
          ctx.restore();
        }
        if (s.foxT > 0 && t) {
          const up = Math.sin(Math.min(1, s.foxT) * Math.PI);
          blit(ctx, 'fox-baby', t.dx + 34, t.dy + 4 - up * 10, { h: 52 * up + 1, noTrack: true });
        }
        for (const f of s.puffs) {
          ctx.save(); ctx.globalAlpha = f.t * 1.4; ctx.fillStyle = '#efe0bd';
          ctx.beginPath(); ctx.arc(f.x, f.y - (0.5 - f.t) * 30, 10 + (0.5 - f.t) * 24, 0, TAU); ctx.fill(); ctx.restore();
        }

        // Båda systrarna på borggårdens stenläggning (fri från fontänen vid vinst)
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.18 : 1.30;
        if (!api.levelWon) {
          s.stage.lead.jump = Math.max(s.stage.lead.jump, s.heroJump);
          s.stage.buddy.jump = Math.max(s.stage.buddy.jump, s.buddyJump);
        }
        drawHeroStage(ctx, T, s.stage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon, leadPose: 'idle', buddyPose: 'cheer',
        });

        // Pekhand: nästa avtryck, annars gropen
        if (!api.levelWon && t && s.flyT === 0 && ((s.opened === 0 && s.step === 0) || s.idleT > (s.dug > 0 || s.step > 0 ? 0.7 : 2.0))) {
          const n = s.trail[s.step];
          if (n) drawGuideHand(ctx, T, n.x + 6, n.y + 6);
          else drawGuideHand(ctx, T, t.dx + 6, t.dy - 4);
        }
      },
    };
  },
};
