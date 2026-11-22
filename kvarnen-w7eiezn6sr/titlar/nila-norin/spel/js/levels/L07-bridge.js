import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawHeartPath, playSfx, playNote,
} from '../core.js';

export const level07 = {
  id: 'bridge',
  shortTitle: 'Bro',
  title: 'Brobyggaren',
  art: 'bro',
  bg: 'back',
  tint: '#b8d7cd',
  goalTotal: 3,
  rounds: 5,
  goalArt: 'bro',
  bookDesc: 'En fin bro av sten, björkstock och blomplanka över bäcken!',

  create(api) {
    // Varje runda vill en ny skogsfamilj över ån (alla målade i atlasen).
    const FAM = [['hedge', 'bunny', 'fox'], ['bear', 'hedge-baby', 'bunny-baby'], ['owl', 'fox-baby', 'owl-baby'], ['fox', 'bunny-baby', 'hedge'], ['bear', 'bunny', 'fox-baby']];
    const fam = FAM[((api.round || 1) - 1) % FAM.length];
    const s = {
      idleT: 0,
      placed: 0,
      dragging: null,
      selected: null,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      inited: false, riverWave: 0,
      slots: [
        { id: 'stone', shape: 'round', x: 0, y: 0, filled: false, popT: 0, note: 0 },
        { id: 'log', shape: 'wide', x: 0, y: 0, filled: false, popT: 0, note: 2 },
        { id: 'plank', shape: 'petal', x: 0, y: 0, filled: false, popT: 0, note: 4 },
      ],
      pieces: [
        { id: 'log', shape: 'wide', x: 0, y: 0, homeX: 0, homeY: 0, done: false },
        { id: 'plank', shape: 'petal', x: 0, y: 0, homeX: 0, homeY: 0, done: false },
        { id: 'stone', shape: 'round', x: 0, y: 0, homeX: 0, homeY: 0, done: false },
      ],
      walkers: [
        { id: fam[0], prog: 0, targetProg: 0, hop: 0, lastNote: -1, rx: 0.11, ry: 0.50, ex: 0.78, ey: 0.48 },
        { id: fam[1], prog: 0, targetProg: 0, hop: 0, lastNote: -1, rx: 0.20, ry: 0.62, ex: 0.87, ey: 0.62 },
        { id: fam[2], prog: 0, targetProg: 0, hop: 0, lastNote: -1, rx: 0.11, ry: 0.76, ex: 0.76, ey: 0.76 },
      ],
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      // Rundor: brodelarnas ordning i ån och på stranden byts varje runda.
      const rr = ((api.round || 1) - 1);
      const sx0 = land ? [0.39, 0.50, 0.61] : [0.27, 0.50, 0.73];
      const sx = [sx0[(0 + rr) % 3], sx0[(1 + rr * 2) % 3], sx0[(2 + rr) % 3]];
      if (new Set(sx).size < 3) { sx[0] = sx0[rr % 3]; sx[1] = sx0[(rr + 1) % 3]; sx[2] = sx0[(rr + 2) % 3]; }
      const sy = land ? 0.60 : 0.54;
      s.slots.forEach((sl, i) => {
        sl.x = pr.x + pr.w * sx[i];
        sl.y = pr.y + pr.h * sy;
      });
      s.pieces.forEach((p, i) => {
        const j = (i + rr * 2) % 3;
        p.homeX = pr.x + pr.w * (land ? (0.30 + j * 0.20) : (0.24 + j * 0.26));
        p.homeY = pr.y + pr.h * (land ? 0.24 : 0.24);
        if (!s.inited || (!p.done && s.dragging !== p)) {
          p.x = p.homeX;
          p.y = p.homeY;
        }
      });
      s.heroPos = [pr.x + pr.w * (land ? 0.85 : 0.80), pr.y + pr.h * (land ? 0.64 : 0.78)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.88 : 0.62), pr.y + pr.h * (land ? 0.82 : 0.82)];
      s.inited = true;
      return pr;
    }

    function drawBridgePiece(ctx, shape, x, y, ghost = false, sc = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      if (ghost) {
        ctx.strokeStyle = 'rgba(255, 240, 152, 0.9)';
        ctx.fillStyle = 'rgba(255, 248, 214, 0.28)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
      } else {
        drawShadow(ctx, 0, 10, 26, 7, 0.24);
      }

      if (shape === 'round') {
        if (!ghost) { ctx.fillStyle = '#9aa8a0'; ctx.strokeStyle = '#4f5a53'; ctx.lineWidth = 2.4; }
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 17, 0, 0, TAU); ctx.fill(); ctx.stroke();
        if (!ghost) {
          ctx.fillStyle = '#75b268';
          ctx.beginPath(); ctx.ellipse(-10, -5, 9, 5, -0.3, 0, TAU); ctx.fill();
        }
      } else if (shape === 'wide') {
        if (!ghost) { ctx.fillStyle = '#e8dfd0'; ctx.strokeStyle = '#6c5a46'; ctx.lineWidth = 2.4; }
        ctx.beginPath(); ctx.roundRect(-30, -12, 60, 24, 10); ctx.fill(); ctx.stroke();
        if (!ghost) {
          ctx.strokeStyle = '#5c4d3e';
          ctx.lineWidth = 2;
          for (const dx of [-16, 4, 18]) {
            ctx.beginPath(); ctx.moveTo(dx, -9); ctx.lineTo(dx + 3, 2); ctx.stroke();
          }
        }
      } else {
        if (!ghost) { ctx.fillStyle = '#cfa06b'; ctx.strokeStyle = '#6d4a26'; ctx.lineWidth = 2.4; }
        ctx.beginPath(); ctx.roundRect(-28, -14, 56, 28, 6); ctx.fill(); ctx.stroke();
        if (!ghost) {
          ctx.fillStyle = '#ff92b8';
          ctx.beginPath(); ctx.arc(-14, 0, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd95e';
          ctx.beginPath(); ctx.arc(14, 0, 5, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }

    function snapPiece(p, slot) {
      p.done = true;
      slot.filled = true;
      slot.popT = 1;
      s.dragging = null;
      s.selected = null;
      s.placed++;
      playSfx('land');
      playNote(slot.note, 0.36);
      s.heroJump = 0.7;
      s.buddyJump = 0.7;
      s.heroExpr = 'skratt';
      s.heroExprT = 1.0;
      api.particles.burst(slot.x, slot.y, 14, { colors: ['#9be5ff', '#ffe17a', '#ffffff'] });
      api.setProgress(s.placed);

      // Ett djur traskar glatt över för varje lagd brodel!
      if (s.placed >= 1) s.walkers[0].targetProg = s.placed >= 3 ? 1 : 0.35;
      if (s.placed >= 2) s.walkers[1].targetProg = s.placed >= 3 ? 1 : 0.55;
      if (s.placed >= 3) {
        s.walkers.forEach((w) => { w.targetProg = 1; });
        api.win(3);
      }
    }

    return {
      _s: s,
      update(dt, W, H) {
        layout(W, H);
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.4);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.4);
        if (s.riverWave > 0) s.riverWave = Math.max(0, s.riverWave - dt * 1.8);
        for (const sl of s.slots) if (sl.popT > 0) sl.popT = Math.max(0, sl.popT - dt * 3.5);
        for (const w of s.walkers) {
          if (w.hop > 0) w.hop = Math.max(0, w.hop - dt * 2.6);
          w.prog = lerp(w.prog, w.targetProg, Math.min(1, dt * 2.2));
          const stepIdx = w.prog > 0.68 ? 2 : w.prog > 0.50 ? 1 : w.prog > 0.34 ? 0 : -1;
          if (stepIdx > w.lastNote && s.slots[stepIdx]?.filled) {
            w.lastNote = stepIdx;
            s.slots[stepIdx].popT = 0.7;
          }
        }
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Ta tag i brodel
        for (const p of s.pieces) {
          if (!p.done && dist(x, y, p.x, p.y) < 42) {
            s.dragging = p;
            s.selected = p;
            playSfx('ok');
            return;
          }
        }

        // 2. Tryck på matchande broplats om del är vald (eller klicka lagd brodel för ton!)
        for (const sl of s.slots) {
          if (dist(x, y, sl.x, sl.y) < 48) {
            if (sl.filled) {
              sl.popT = 1;
              playNote(sl.note, 0.34);
              api.particles.burst(sl.x, sl.y, 8, { kind: 'star' });
              return;
            }
            if (s.selected && !s.selected.done) {
              if (s.selected.id === sl.id) {
                snapPiece(s.selected, sl);
              } else {
                playSfx('softno');
              }
              return;
            }
          }
        }

        // 2b. Skogsvännerna som väntar/går över bron!
        const pr = layout(W, H);
        for (let idx = 0; idx < s.walkers.length; idx++) {
          const w = s.walkers[idx];
          const wx = lerp(pr.x + pr.w * w.rx, pr.x + pr.w * w.ex, w.prog);
          const wy = lerp(pr.y + pr.h * w.ry, pr.y + pr.h * w.ey, w.prog);
          if (dist(x, y, wx, wy - 24) < 42) {
            w.hop = 1;
            playNote(idx * 2, 0.32);
            api.particles.burst(wx, wy - 36, 10, { kind: 'heart', colors: ['#ff93b0', '#ffe17a'] });
            return;
          }
        }

        // 3. Tryck på systrarna → glädjehopp
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

        // 4. Vattenplask i bäcken → våg som guppar brodelarna!
        s.riverWave = 1;
        playSfx('water'); playNote(1, 0.24);
        api.particles.burst(x, y, 8, { colors: ['#98e5ff', '#ffffff'], lift: 60 });
      },

      onMove(x, y) {
        if (!s.dragging) return;
        s.dragging.x = x;
        s.dragging.y = y;
      },

      onUp() {
        if (!s.dragging) return;
        const p = s.dragging;
        s.dragging = null;
        const match = s.slots.find((sl) => !sl.filled && sl.id === p.id);
        if (match && dist(p.x, p.y, match.x, match.y) < 68) {
          snapPiece(p, match);
          return;
        }
        for (const sl of s.slots) {
          if (!sl.filled && dist(p.x, p.y, sl.x, sl.y) < 52) {
            playSfx('softno');
            p.x = p.homeX; p.y = p.homeY;
            return;
          }
        }
        p.x = p.homeX; p.y = p.homeY;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);
        const active = s.dragging || s.selected;

        // Bro-silhuetter eller lagda brodelar i bäcken
        for (const sl of s.slots) {
          if (!sl.filled) {
            if (active && active.id === sl.id) {
              drawGlowRing(ctx, T, sl.x, sl.y, 38, 'rgba(255, 224, 112, 0.9)');
            }
            drawBridgePiece(ctx, sl.shape, sl.x, sl.y, true, 1);
          } else {
            const sc = 1 + Math.sin(sl.popT * Math.PI) * 0.16;
            drawBridgePiece(ctx, sl.shape, sl.x, sl.y, false, sc);
          }
        }

        // Djur som går över bäcken till systrarna!
        s.walkers.forEach((w, idx) => {
          const sx = pr.x + pr.w * w.rx;
          const sy = pr.y + pr.h * w.ry;
          const ex = pr.x + pr.w * w.ex;
          const ey = pr.y + pr.h * w.ey;
          const wx = lerp(sx, ex, w.prog);
          const wy = lerp(sy, ey, w.prog) - (w.prog > 0 && w.prog < 1 ? Math.abs(Math.sin(w.prog * Math.PI * 5)) * 12 : 0) - Math.sin(w.hop * Math.PI) * 18;
          drawShadow(ctx, wx, wy + 2, 18, 5);
          blit(ctx, w.id, wx, wy, { h: 62, face: 1 });
          if (w.prog > 0.95) {
            ctx.save();
            ctx.translate(wx, wy - 64 + Math.sin(T * 3 + idx) * 4);
            ctx.fillStyle = '#ff7da4';
            drawHeartPath(ctx, 8);
            ctx.fill();
            ctx.restore();
          }
        });

        // Systrarna på högra stranden (eller dansar mitt i glädjen vid vinst)
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
            bob: s.heroJump > 0 ? -Math.sin(s.heroJump * Math.PI) * 26 : 0, face: -1,
          });
          drawHero(ctx, T, s.buddyPos[0], s.buddyPos[1], {
            who: buddyId, scale: heroScale * 0.88,
            expr: s.buddyJump > 0 ? 'skratt' : 'glad',
            pose: s.buddyJump > 0 ? 'jump' : 'idle',
            bob: s.buddyJump > 0 ? -Math.sin(s.buddyJump * Math.PI) * 24 : 0, face: -1,
          });
        }

        // Brodelar att dra
        for (const p of s.pieces) {
          if (p.done) continue;
          const held = s.dragging === p || s.selected === p;
          if (!held) drawGlowRing(ctx, T, p.x, p.y, 32, 'rgba(255, 224, 120, 0.5)');
          const floatBob = held ? -6 : Math.sin(T * 2.5 + p.homeX) * 3.5 - Math.sin(s.riverWave * Math.PI) * 9;
          drawBridgePiece(ctx, p.shape, p.x, p.y + floatBob, false, held ? 1.15 : 1);
        }

        // Pekhand
        if (!api.won && (s.placed === 0 || s.idleT > 2.8)) {
          const nextP = active || s.pieces.find((p) => !p.done);
          if (nextP) {
            const sl = s.slots.find((k) => k.id === nextP.id);
            if (sl) drawGuideHand(ctx, T, nextP.x, nextP.y, sl.x, sl.y);
          }
        }
      },
    };
  },
};
