import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawMushroom, playSfx, playNote,
} from '../core.js';

export const level05 = {
  id: 'music',
  shortTitle: 'Musik',
  title: 'Musikgläntan',
  icon: '🍄',
  bg: 'glanta',
  tint: '#c9d7b6',
  goalTotal: 3,
  goalIcon: '🎵',
  bookDesc: 'Skogens svamptrummor spelar glada visor med djuren!',

  create(api) {
    const SONGS = [
      [0, 2],
      [1, 3, 2],
      [0, 1, 2, 3],
    ];
    const FRIENDS = ['owl', 'fox', 'bunny'];

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
      shrooms: [
        { i: 0, color: '#e9735e', note: 0, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 1, color: '#f2bb48', note: 1, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 2, color: '#6ec798', note: 2, squash: 0, glow: 0, x: 0, y: 0 },
        { i: 3, color: '#9f87ea', note: 4, squash: 0, glow: 0, x: 0, y: 0 },
      ],
      fans: [],
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
      s.heroPos = [pr.x + pr.w * (land ? 0.12 : 0.22), pr.y + pr.h * (land ? 0.78 : 0.88)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.88 : 0.78), pr.y + pr.h * (land ? 0.78 : 0.88)];
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
      return pr;
    }

    function startDemo() {
      s.phase = 'demo';
      s.demoIdx = 0;
      s.demoT = 0.45;
      s.step = 0;
    }

    function hitShroom(m, fromDemo = false) {
      m.squash = 1;
      m.glow = 1;
      playNote(m.note, 0.42);
      api.particles.burst(m.x, m.y - 26, 12, { kind: 'star', colors: [m.color, '#ffe885', '#ffffff'] });
      if (fromDemo) return;

      s.heroJump = 0.55;
      s.buddyJump = 0.45;
      s.heroExpr = 'skratt';
      s.heroExprT = 0.6;
      if (api.won || s.phase !== 'play') return;

      const song = SONGS[s.round];
      const expected = song[s.step];
      if (m.i === expected) {
        s.step++;
        if (s.step >= song.length) {
          // Runda klar! Väck ett nytt skogsdjur till gläntan
          s.fans.push(FRIENDS[s.round]);
          s.round++;
          playSfx('pling');
          s.heroJump = 1;
          s.buddyJump = 1;
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

    return {
      _s: s,
      update(dt, W, H) {
        layout(W, H);
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.6);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.6);
        for (const m of s.shrooms) {
          if (m.squash > 0) m.squash = Math.max(0, m.squash - dt * 4.2);
          if (m.glow > 0) m.glow = Math.max(0, m.glow - dt * 1.8);
        }

        if (s.phase === 'demo' && !api.won) {
          const song = SONGS[s.round];
          const target = s.shrooms[song[s.demoIdx]];
          if (target) {
            s.flyX = lerp(s.flyX, target.x, Math.min(1, dt * 8));
            s.flyY = lerp(s.flyY, target.y - 54, Math.min(1, dt * 8));
          }
          s.demoT -= dt;
          if (s.demoT <= 0) {
            if (target) hitShroom(target, true);
            s.demoIdx++;
            if (s.demoIdx >= song.length) {
              s.phase = 'play';
              s.step = 0;
            } else {
              s.demoT = 0.58;
            }
          }
        } else if (!api.won) {
          const song = SONGS[s.round];
          const next = s.shrooms[song[s.step]];
          if (next) {
            s.flyX = lerp(s.flyX, next.x, Math.min(1, dt * 6));
            s.flyY = lerp(s.flyY, next.y - 56, Math.min(1, dt * 6));
          }
        }
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

        // 3. Systrarna
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
        }
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
          ctx.font = '20px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🎵', rx, ry + 1);
          ctx.restore();
        }

        // Vaknade djurpublik som gungar i takt!
        s.fans.forEach((fid, idx) => {
          const fx = pr.x + pr.w * (0.34 + idx * 0.16);
          const fy = pr.y + pr.h * 0.44 + Math.sin(T * 5 + idx) * 4;
          drawShadow(ctx, fx, fy + 2, 20, 6);
          blit(ctx, fid, fx, fy, { h: 66 });
        });

        // Svampar
        const curExpected = !api.won && s.phase === 'play' ? SONGS[s.round][s.step] : -1;
        for (const m of s.shrooms) {
          if (m.glow > 0 || m.i === curExpected) {
            drawGlowRing(ctx, T, m.x, m.y - 24, 34, m.glow > 0 ? '#ffe46e' : 'rgba(255, 224, 120, 0.55)');
          }
          drawMushroom(ctx, m.x, m.y, 26, m.color, m.squash);
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

        // Pekhand om spelaren pausar
        if (!api.won && s.phase === 'play' && (s.round === 0 && s.step === 0 || s.idleT > 2.5)) {
          const next = s.shrooms[SONGS[s.round][s.step]];
          if (next) drawGuideHand(ctx, T, next.x + 8, next.y - 22);
        }
      },
    };
  },
};
