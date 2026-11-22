import {
  TAU, clamp, lerp, dist,
  easeOutBack, blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawMushroom, playSfx, playNote, drawIkon,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level05 = {
  id: 'music',
  shortTitle: 'Musik',
  title: 'Musikgläntan',
  art: 'not',
  bg: 'glanta',
  tint: '#c9d7b6',
  goalTotal: 3,
  rounds: 3,
  goalArt: 'not',
  bookDesc: 'Skogens svamptrummor spelar glada visor med djuren!',

  create(api) {
    // Rundor: melodierna blir en ton längre per runda, och nya vänner vaknar i gläntan.
    const SONGS = [
      [[0, 2], [1, 3, 2], [0, 1, 2, 3]],
      [[2, 0, 1], [3, 1, 2, 0], [0, 2, 1, 3, 2]],
      [[1, 2, 3, 0], [0, 3, 1, 2, 3], [2, 1, 0, 3, 1, 2]],
    ][((api.round || 1) - 1) % 3];
    const FRIENDS = [['owl', 'fox', 'bunny'], ['hedge', 'bear', 'bird'], ['owl-baby', 'fox-baby', 'bunny-baby']][((api.round || 1) - 1) % 3];

    const s = {
      idleT: 0,
      round: 0,
      step: 0,
      phase: 'play', // 'demo' | 'play'
      demoIdx: 0,
      demoT: 0.45,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      flyX: 0,
      flyY: 0,
      inited: false,
      stage: createHeroStage(),
      shrooms: [
        { i: 0, color: '#e9735e', note: 0, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 1, color: '#f2bb48', note: 1, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 2, color: '#6ec798', note: 2, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 3, color: '#9f87ea', note: 4, squash: 0, glow: 0, x: 0, y: 0 },
      ],
      fans: [], notes: [],
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      const xs = land ? [0.24, 0.41, 0.59, 0.76] : [0.22, 0.41, 0.59, 0.78];
      const ys = land ? [0.70, 0.76, 0.76, 0.70] : [0.64, 0.72, 0.72, 0.64];
      s.shrooms.forEach((m, i) => {
        m.x = pr.x + pr.w * xs[i];
        m.y = pr.y + pr.h * ys[i];
      });
      s.heroPos = [pr.x + pr.w * (land ? 0.13 : 0.20), pr.y + pr.h * (land ? 0.88 : 0.90)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.87 : 0.80), pr.y + pr.h * (land ? 0.88 : 0.90)];
      s.replayBtn = [pr.x + pr.w * 0.5, pr.y + pr.h * (land ? 0.22 : 0.20)];
      if (!s.inited) {
        const first = s.shrooms[SONGS[0][0]];
        s.flyX = first.x;
        s.flyY = first.y - 54;
        s.phase = 'demo';
        s.demoIdx = 0;
        s.demoT = 0.55;
        s.inited = true;
      }
      s.lastPr = pr;
      return pr;
    }

    function startDemo() {
      s.phase = 'demo';
      s.demoIdx = 0;
      s.demoT = 0.45;
      s.demoWatch = 0;
      s.step = 0;
    }

    function hitShroom(m, fromDemo = false) {
      m.squash = 1;
      m.glow = 1;
      playNote(m.note, 0.42);
      api.particles.burst(m.x, m.y - 26, 12, { kind: 'star', colors: [m.color, '#ffe885', '#ffffff'] });
      if (fromDemo) {
        s.heroJump = 0.35; s.buddyJump = 0.35;
        return;
      }

      s.heroJump = 0.55;
      s.buddyJump = 0.45;
      for (const f of s.fans) f.hop = 0.85;
      if (s.fans.length) playNote((m.note + 2) % 6, 0.22);
      if (s.heroPos) s.notes.push({ ax: m.x, ay: m.y - 28, bx: s.heroPos[0], by: s.heroPos[1] - 58, t: 0, c: m.color });
      if (s.buddyPos) s.notes.push({ ax: m.x, ay: m.y - 28, bx: s.buddyPos[0], by: s.buddyPos[1] - 58, t: 0, c: '#ffe885' });
      s.heroExpr = 'skratt';
      s.heroExprT = 0.6;
      if (api.won || s.phase !== 'play') return;

      const song = SONGS[s.round];
      const expected = song[s.step];
      if (m.i === expected) {
        s.step++;
        if (s.step >= song.length) {
          // Runda klar! Väck ett nytt skogsdjur till gläntan
          const fanIdx = s.fans.length;
          s.fans.push({ id: FRIENDS[s.round], hop: 1, arrive: 0, note: s.round + 2 });
          if (s.lastPr) {
            const fx = s.lastPr.x + s.lastPr.w * (0.34 + fanIdx * 0.16);
            const fy = s.lastPr.y + s.lastPr.h * 0.44;
            api.particles.burst(fx, fy - 24, 18, { kind: 'star', colors: ['#fff6c8', '#ffe17a', '#b8f0c8', '#ffffff'], speed: 120 });
          }
          s.round++;
          playSfx('pling');
          s.heroJump = 1;
          s.buddyJump = 1;
          reactHeroStage(s.stage, 'both', 'skratt', 0.95);
          api.setProgress(s.round);
          if (s.round >= SONGS.length) {
            api.win(3);
          } else {
            startDemo();
          }
        }
      } else {
        // Mjuk vägledning utan straff: eldflugan visar rätt svamp!
        const target = s.shrooms[expected];
        if (target) target.glow = 1.2;
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * (W >= H ? 0.88 : 0.90);
    }
    function standPoints(W, H) {
      layout(W, H);
      const gy = groundY(W, H);
      return {
        lead: [s.heroPos[0], gy],
        buddy: [s.buddyPos[0], gy],
        winLead: [W * 0.23, gy],
        winBuddy: [W * 0.77, gy],
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
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.6);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.6);
        for (const f of s.fans) { if (f.hop > 0) f.hop = Math.max(0, f.hop - dt * 2.8); if (f.arrive != null && f.arrive < 1) f.arrive = Math.min(1, f.arrive + dt * 2.2); }
        for (let i = s.notes.length - 1; i >= 0; i--) {
          s.notes[i].t += dt * 2.4;
          if (s.notes[i].t >= 1) s.notes.splice(i, 1);
        }
        for (const m of s.shrooms) {
          if (m.squash > 0) m.squash = Math.max(0, m.squash - dt * 4.2);
          if (m.glow > 0) m.glow = Math.max(0, m.glow - dt * 1.8);
        }

        // Use levelWon (not api.won) so a 1 s round-switch does not freeze the demo
        // and leave the impatient persona with 7+ s of silence.
        if (s.phase === 'demo' && !api.levelWon) {
          const song = SONGS[s.round];
          if (!song || s.demoIdx >= song.length) {
            s.phase = 'play';
            s.step = 0;
          } else {
            const target = s.shrooms[song[s.demoIdx]];
            if (target) {
              s.flyX = lerp(s.flyX, target.x, Math.min(1, dt * 8));
              s.flyY = lerp(s.flyY, target.y - 54, Math.min(1, dt * 8));
            }
            s.demoT -= dt;
            s.demoWatch = (s.demoWatch || 0) + dt;
            if (s.demoT <= 0 || s.demoWatch > 1.4) {
              if (target) hitShroom(target, true);
              s.demoWatch = 0;
              s.demoIdx++;
              if (s.demoIdx >= song.length) {
                s.phase = 'play';
                s.step = 0;
              } else {
                s.demoT = 0.58;
              }
            }
          }
        } else if (!api.levelWon) {
          const song = SONGS[s.round];
          const next = song ? s.shrooms[song[s.step]] : null;
          if (next) {
            s.flyX = lerp(s.flyX, next.x, Math.min(1, dt * 6));
            s.flyY = lerp(s.flyY, next.y - 56, Math.min(1, dt * 6));
          }
        }
        updateHeroStage(s.stage, dt, { won: api.levelWon, pts: standPoints(W, H) });
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Lyssna-igen-knapp (eldflugeklockan)
        if (!api.won && s.replayBtn && dist(x, y, s.replayBtn[0], s.replayBtn[1]) < 34) {
          startDemo();
          playSfx('star');
          return;
        }

        // 2. Svamptrummor (fungerar även under demo → avbryter snällt så barnet aldrig blockeras!)
        for (const m of s.shrooms) {
          if (dist(x, y, m.x, m.y - 22) < 48) {
            if (s.phase === 'demo') s.phase = 'play';
            hitShroom(m, false);
            return;
          }
        }

        // 2b. Vaknade djurvänner sjunger i kör!
        const pr = layout(W, H);
        for (let idx = 0; idx < s.fans.length; idx++) {
          const fan = s.fans[idx];
          const fx = pr.x + pr.w * (0.34 + idx * 0.16);
          const fy = pr.y + pr.h * 0.44;
          if (dist(x, y, fx, fy - 24) < 42) {
            fan.hop = 1;
            playNote(fan.note, 0.4);
            api.particles.burst(fx, fy - 42, 12, { kind: 'heart', colors: ['#ffe17a', '#ff9ec4', '#ffffff'] });
            return;
          }
        }

        // 2c. Eldflugan snurrar och glittrar!
        if (!api.won && dist(x, y, s.flyX, s.flyY) < 38) {
          playSfx('star');
          playNote(5, 0.25);
          api.particles.burst(s.flyX, s.flyY, 12, { kind: 'star', colors: ['#fff9bd', '#ffe46e', '#ffffff'] });
          return;
        }

        // 3. Systrarna
        if (s.heroPos && dist(x, y, s.heroPos[0], s.heroPos[1] - 42) < 52) {
          s.heroJump = 1; s.heroExpr = 'skratt'; s.heroExprT = 0.9;
          playSfx('cheer'); playNote(0, 0.35);
          for (const f of s.fans) { f.hop = 1; playNote(f.note, 0.3); }
          api.particles.burst(s.heroPos[0], s.heroPos[1] - 54, 14, { kind: 'heart' });
          return;
        }
        if (s.buddyPos && dist(x, y, s.buddyPos[0], s.buddyPos[1] - 42) < 52) {
          s.buddyJump = 1;
          playSfx('pling'); playNote(4, 0.35);
          for (const f of s.fans) { f.hop = 1; playNote(f.note, 0.3); }
          api.particles.burst(s.buddyPos[0], s.buddyPos[1] - 54, 14, { kind: 'star' });
          return;
        }
        // Gläntans eldflugor & toner svarar var man än pekar!
        playNote(Math.floor((x / Math.max(1, W)) * 5), 0.25);
        api.particles.burst(x, y, 8, { kind: 'star', colors: ['#fff9bd', '#ffe46e', '#9be296'] });
      },

      onMove() {},
      onUp() {},

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Lyssna-igen-ikon (eldfluga med not)
        if (!api.won && s.replayBtn) {
          const [rx, ry] = s.replayBtn;
          ctx.save();
          ctx.fillStyle = 'rgba(253, 247, 234, 0.9)';
          ctx.strokeStyle = '#9c7840';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(rx, ry, 24, 0, TAU); ctx.fill(); ctx.stroke();
          drawIkon(ctx, 'not', rx, ry + 1, 30, { noTrack: true });
          ctx.restore();
        }

        // Vaknade djurpublik som gungar och sjunger i kör!
        s.fans.forEach((fan, idx) => {
          const arr = fan.arrive != null ? easeOutBack(clamp(fan.arrive, 0, 1)) : 1;
          const sc = Math.max(0.15, arr);
          const fx = pr.x + pr.w * (0.34 + idx * 0.16);
          const fy = pr.y + pr.h * 0.44 + Math.sin(T * 5 + idx) * 4 - Math.sin(fan.hop * Math.PI) * 18;
          drawShadow(ctx, fx, pr.y + pr.h * 0.44 + 2, 20 * sc, 6 * sc);
          blit(ctx, fan.id, fx, fy, { h: 66 * sc });
        });

        // Svampar
        const curExpected = !api.won && s.phase === 'play' ? SONGS[s.round][s.step] : -1;
        for (const m of s.shrooms) {
          if (m.glow > 0 || m.i === curExpected) {
            drawGlowRing(ctx, T, m.x, m.y - 24, 34, m.glow > 0 ? '#ffe46e' : 'rgba(255, 224, 120, 0.55)');
          }
          drawMushroom(ctx, m.x, m.y, 26, m.color, m.squash);
        }

        // Flygande duett-toner mellan svampar & kör
        for (const nt of s.notes) {
          const nx = lerp(nt.ax, nt.bx, nt.t);
          const ny = lerp(nt.ay, nt.by, nt.t) - Math.sin(nt.t * Math.PI) * 34;
          ctx.save(); ctx.fillStyle = nt.c; ctx.globalAlpha = 1 - nt.t * 0.4;
          ctx.beginPath(); ctx.arc(nx, ny, 6, 0, TAU); ctx.fill();
          ctx.restore();
        }
        // Eldfluga
        if (!api.won) {
          ctx.save();
          const g = ctx.createRadialGradient(s.flyX, s.flyY, 3, s.flyX, s.flyY, 20);
          g.addColorStop(0, '#fff9bd');
          g.addColorStop(0.5, 'rgba(255, 228, 108, 0.7)');
          g.addColorStop(1, 'rgba(255, 228, 108, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.flyX, s.flyY, 20, 0, TAU); ctx.fill();
          ctx.restore();
        }

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.15;
        if (!api.levelWon) {
          s.stage.lead.jump = Math.max(s.stage.lead.jump, s.heroJump);
          s.stage.buddy.jump = Math.max(s.stage.buddy.jump, s.buddyJump);
        }
        drawHeroStage(ctx, T, s.stage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon, leadPose: 'idle', buddyPose: 'idle',
        });

        // Pekhand om spelaren pausar
        if (!api.levelWon && (s.idleT > (s.phase === 'demo' ? 1.8 : 2.0) || (s.phase === 'play' && s.round === 0 && s.step === 0))) {
          const song = SONGS[s.round];
          const idx = s.phase === 'demo' ? s.demoIdx : s.step;
          const next = song ? s.shrooms[song[idx]] : null;
          if (next) drawGuideHand(ctx, T, next.x + 8, next.y - 22);
        }
      },
    };
  },
};
