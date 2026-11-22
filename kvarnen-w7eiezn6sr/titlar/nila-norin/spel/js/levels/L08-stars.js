import {
  TAU, clamp, dist,
  drawHero, drawGlowRing, drawGuideHand,
  drawStarPath, playSfx, playNote, drawIkon,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level08 = {
  id: 'stars',
  shortTitle: 'Stjärnor',
  title: 'Stjärnhimlen',
  art: 'stjarna',
  bg: 'natt',
  tint: '#1c2b4a',
  goalTotal: 2,
  rounds: 4,
  goalArt: 'gnista',
  bookDesc: 'Lysande stjärnbilder ritade av Nila & Norin i natthimlen!',

  create(api) {
    // 1.9: fyra rundor à två stjärnbilder som växer milt (5–7 stjärnor). Varje färdig bild
    // ”vaknar” — den målade figuren tänds i himlen (skogens djur och systrarnas saker).
    const ALL = [
      { name: 'Krona', art: 'krona', pts: [[0.30, 0.56], [0.38, 0.28], [0.50, 0.44], [0.62, 0.28], [0.70, 0.56]], close: true },
      { name: 'Hjärta', art: 'hjarta', pts: [[0.50, 0.62], [0.32, 0.40], [0.40, 0.24], [0.50, 0.34], [0.60, 0.24], [0.68, 0.40]], close: true },
      { name: 'Stjärna', art: 'star', pts: [[0.50, 0.20], [0.64, 0.60], [0.30, 0.36], [0.70, 0.36], [0.36, 0.60]], close: true },
      { name: 'Blomma', art: 'sunflower', pts: [[0.50, 0.22], [0.64, 0.36], [0.59, 0.58], [0.41, 0.58], [0.36, 0.36]], close: true },
      { name: 'Fjäril', art: 'butterfly', pts: [[0.50, 0.45], [0.32, 0.26], [0.34, 0.58], [0.50, 0.45], [0.68, 0.26], [0.66, 0.58]], close: false },
      { name: 'Uggla', art: 'owl', pts: [[0.42, 0.28], [0.50, 0.20], [0.58, 0.28], [0.62, 0.50], [0.50, 0.62], [0.38, 0.50]], close: true },
      { name: 'Räv', art: 'fox', pts: [[0.34, 0.24], [0.43, 0.40], [0.57, 0.40], [0.66, 0.24], [0.62, 0.50], [0.50, 0.62], [0.38, 0.50]], close: true },
      { name: 'Kanin', art: 'bunny', pts: [[0.44, 0.16], [0.46, 0.38], [0.37, 0.54], [0.50, 0.64], [0.63, 0.54], [0.54, 0.38], [0.56, 0.16]], close: false },
    ];
    const r0 = ((api.round || 1) - 1) * 2;
    const CONSTELLATIONS = [ALL[r0 % ALL.length], ALL[(r0 + 1) % ALL.length]];

    const s = {
      idleT: 0,
      stage: 0,
      connected: 0, // antal stjärnor kopplade i nuvarande stjärnbild (1..pts.length)
      drawing: false,
      curX: 0,
      curY: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      doneIcons: [], shootingStars: [],
      skyPts: [],
      heroStage: createHeroStage(),
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      const skyH = pr.h * (land ? 0.72 : 0.62);
      const cur = CONSTELLATIONS[Math.min(s.stage, CONSTELLATIONS.length - 1)];
      s.skyPts = cur.pts.map(([rx, ry], i) => ({
        i,
        x: pr.x + pr.w * rx,
        y: pr.y + skyH * ry,
      }));
      s.heroPos = [pr.x + pr.w * (land ? 0.18 : 0.26), pr.y + pr.h * 0.87];
      s.buddyPos = [pr.x + pr.w * (land ? 0.82 : 0.74), pr.y + pr.h * 0.87];
      return pr;
    }

    function advanceStar(pt) {
      s.connected++;
      playNote((s.connected - 1) % 6, 0.4);
      s.heroExpr = 'forvanad';
      s.heroExprT = 0.7;
      api.particles.burst(pt.x, pt.y, 12, { kind: 'star', colors: ['#ffe878', '#ffffff', '#9bdcff'] });

      const cur = CONSTELLATIONS[s.stage];
      if (s.connected >= cur.pts.length) {
        s.drawing = false;
        s.doneIcons.push({ art: cur.art, name: cur.name, hop: 1 });
        const cx = s.skyPts.reduce((a2, p) => a2 + p.x, 0) / s.skyPts.length;
        const cy = s.skyPts.reduce((a2, p) => a2 + p.y, 0) / s.skyPts.length;
        s.shootingStars.push({ x: cx - 80, y: cy - 30, vx: 220, vy: 55, t: 0.7 });
        s.wake = { art: cur.art, x: cx, y: cy, t: 1.6 };
        api.particles.burst(cx, cy, 22, { kind: 'star', colors: ['#ffe878', '#ffffff', '#ffd1e8'] });
        s.stage++;
        s.connected = 0;
        playSfx('pling');
        s.heroExpr = 'skratt';
        s.heroExprT = 1.1;
        s.heroJump = 1;
        s.buddyJump = 1;
        api.setProgress(s.stage);
        if (s.stage >= CONSTELLATIONS.length) {
          reactHeroStage(s.heroStage, 'both', 'skratt', 0.95);
          api.win(3);
        }
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * 0.87;
    }
    function standPoints(W, H) {
      layout(W, H);
      const gy = groundY(W, H);
      return {
        lead: [s.heroPos[0], gy],
        buddy: [s.buddyPos[0], gy],
        winLead: [W * 0.42, gy],
        winBuddy: [W * 0.58, gy],
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
        if (s.wake) { s.wake.t -= dt; if (s.wake.t <= 0) s.wake = null; }
        for (const d of s.doneIcons) if (d.hop > 0) d.hop = Math.max(0, d.hop - dt * 2.4);
        for (let i = s.shootingStars.length - 1; i >= 0; i--) {
          const st = s.shootingStars[i];
          st.x += st.vx * dt; st.y += st.vy * dt; st.t -= dt;
          if (st.t <= 0) s.shootingStars.splice(i, 1);
        }
        updateHeroStage(s.heroStage, dt, { won: api.levelWon, pts: standPoints(W, H) });
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;
        if (!api.won && s.skyPts[s.connected]) {
          const next = s.skyPts[s.connected];
          if (dist(x, y, next.x, next.y) < 46) {
            s.drawing = true;
            s.curX = x; s.curY = y;
            advanceStar(next);
            return;
          }
          // Tryckte man nära första stjärnan när connected===0
          if (s.connected > 0 && dist(x, y, s.skyPts[s.connected - 1].x, s.skyPts[s.connected - 1].y) < 42) {
            s.drawing = true;
            s.curX = x; s.curY = y;
            return;
          }
        }

        // Vaknade stjärnbildsvänner i himlen sjunger & skickar stjärnfall!
        const pr = layout(W, H);
        for (let idx = 0; idx < s.doneIcons.length; idx++) {
          const d = s.doneIcons[idx];
          const ix = pr.x + pr.w * (0.24 + idx * 0.17);
          const iy = pr.y + 58;
          if (dist(x, y, ix, iy) < 34) {
            d.hop = 1;
            playNote(idx * 2 + 1, 0.42);
            playSfx('star');
            s.shootingStars.push({ x: ix, y: iy, vx: (idx % 2 ? -1 : 1) * 230, vy: 60, t: 0.65 });
            api.particles.burst(ix, iy, 14, { kind: 'star', colors: ['#ffe878', '#ffffff', '#9bdcff'] });
            return;
          }
        }

        // Systrarna
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

        // Knäpp på natthimlen → små gnistor
        playSfx('star');
        api.particles.burst(x, y, 8, { kind: 'star', colors: ['#ffe878', '#b8dcff'] });
      },

      onMove(x, y) {
        if (!s.drawing || api.won) return;
        s.curX = x; s.curY = y;
        const next = s.skyPts[s.connected];
        if (next && dist(x, y, next.x, next.y) < 44) {
          advanceStar(next);
        }
      },

      onUp() {
        s.drawing = false;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Avklarade stjärnbilder lyser som troféer uppe i hörnet av himlen
        for (const sh of s.shootingStars) {
          ctx.save();
          ctx.globalAlpha = sh.t / 0.7;
          ctx.strokeStyle = '#fff4a8';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(sh.x - sh.vx * 0.14, sh.y - sh.vy * 0.14);
          ctx.stroke();
          ctx.restore();
        }
        s.doneIcons.forEach((d, idx) => {
          const ix = pr.x + pr.w * (0.24 + idx * 0.17);
          const iy = pr.y + 58 + Math.sin(T * 2 + idx) * 4 - Math.sin((d.hop || 0) * Math.PI) * 14;
          drawIkon(ctx, d.art, ix, iy, 34 * (1 + Math.sin((d.hop || 0) * Math.PI) * 0.25));
        });

        // Den nyss färdiga stjärnbilden vaknar: figuren tänds stort i himlen och bleknar in i hörnet
        if (s.wake) {
          const k = s.wake.t / 1.6;
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2.2);
          drawGlowRing(ctx, T, s.wake.x, s.wake.y, 46 + (1 - k) * 20, 'rgba(255, 236, 150, 0.6)');
          drawIkon(ctx, s.wake.art, s.wake.x, s.wake.y - (1 - k) * 18, 74 + (1 - k) * 16, { noTrack: true });
          ctx.restore();
        }

        // Aktiv stjärnbild
        if (!api.won) {
          const cur = CONSTELLATIONS[s.stage];
          // Svag prickad vägledning mellan stjärnor
          ctx.save();
          ctx.strokeStyle = 'rgba(202, 224, 255, 0.34)';
          ctx.lineWidth = 3;
          ctx.setLineDash([7, 8]);
          ctx.beginPath();
          s.skyPts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          if (cur.close && s.skyPts.length) ctx.lineTo(s.skyPts[0].x, s.skyPts[0].y);
          ctx.stroke();
          ctx.restore();

          // Lysande guldstreck mellan redan kopplade stjärnor
          if (s.connected >= 2) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i < s.connected; i++) {
              const p = s.skyPts[i];
              if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.strokeStyle = 'rgba(255, 226, 114, 0.28)';
            ctx.lineWidth = 11;
            ctx.stroke();
            ctx.strokeStyle = '#ffe272';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
          }

          // Aktivt guldstreck under fingret
          if (s.drawing && s.connected > 0) {
            const prev = s.skyPts[s.connected - 1];
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 232, 132, 0.85)';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(s.curX, s.curY); ctx.stroke();
            ctx.restore();
          }

          // Stjärnorna att trycka/dra till
          s.skyPts.forEach((p, idx) => {
            const done = idx < s.connected;
            const isNext = idx === s.connected;
            if (isNext) drawGlowRing(ctx, T, p.x, p.y, 26, 'rgba(255, 230, 112, 0.9)');
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.fillStyle = done ? '#ffe160' : (isNext ? '#fff9cc' : 'rgba(220, 234, 255, 0.72)');
            ctx.strokeStyle = done ? '#f0a61c' : '#85a4d6';
            ctx.lineWidth = 2;
            drawStarPath(ctx, 5, done ? 18 : (isNext ? 17 : 13), done ? 8 : 6.5);
            ctx.fill(); ctx.stroke();
            ctx.restore();
          });
        }

        // Mjukt akvarellmålat skymningsmoln & glödande månbåge under systrarnas fötter
        {
          const gy = groundY(W, H);
          const cx = W * 0.5;
          ctx.save();
          const mg = ctx.createRadialGradient(cx, gy, 18, cx, gy + 12, pr.w * 0.48);
          mg.addColorStop(0, 'rgba(255, 242, 194, 0.28)');
          mg.addColorStop(0.65, 'rgba(164, 190, 240, 0.14)');
          mg.addColorStop(1, 'rgba(28, 43, 74, 0)');
          ctx.fillStyle = mg;
          ctx.beginPath(); ctx.ellipse(cx, gy + 10, pr.w * 0.48, 56, 0, 0, TAU); ctx.fill();

          // Mjukt fluffigt nattmoln i lager som smälter nedåt i bakgrunden
          const puffs = [
            [-0.32, 14, 54], [-0.18, 8, 66], [0, 4, 78], [0.18, 8, 66], [0.32, 14, 54],
          ];
          const cg = ctx.createLinearGradient(0, gy - 12, 0, gy + 48);
          cg.addColorStop(0, 'rgba(232, 238, 255, 0.90)');
          cg.addColorStop(0.45, 'rgba(176, 194, 236, 0.78)');
          cg.addColorStop(1, 'rgba(42, 58, 98, 0.0)');
          ctx.fillStyle = cg;
          for (const [rx, dy, rr] of puffs) {
            ctx.beginPath(); ctx.ellipse(cx + pr.w * rx, gy + dy + 16, rr, rr * 0.52, 0, 0, TAU); ctx.fill();
          }
          // Subtil varm månskensskimmerkant längs ovansidan där fötterna står
          ctx.strokeStyle = 'rgba(255, 244, 198, 0.42)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - pr.w * 0.36, gy + 4);
          ctx.quadraticCurveTo(cx, gy - 8, cx + pr.w * 0.36, gy + 4);
          ctx.stroke();
          ctx.restore();
        }

        // Båda systrarna på månmolnet
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.16 : 1.28;
        if (!api.levelWon) {
          s.heroStage.lead.jump = Math.max(s.heroStage.lead.jump, s.heroJump);
          s.heroStage.buddy.jump = Math.max(s.heroStage.buddy.jump, s.buddyJump);
        }
        drawHeroStage(ctx, T, s.heroStage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon, leadPose: 'idle', buddyPose: 'cheer',
        });

        // Pekhand
        // Mitt i en stjärnbild visas nästa drag snabbt (0,9 s) — annars hinner barnet tappa tråden.
        if (!api.won && ((s.stage === 0 && s.connected === 0) || s.idleT > (s.connected > 0 ? 0.9 : 1.8))) {
          const a = s.skyPts[s.connected];
          const b = s.skyPts[s.connected + 1];
          if (a && b && s.connected > 0) drawGuideHand(ctx, T, s.skyPts[s.connected - 1].x, s.skyPts[s.connected - 1].y, a.x, a.y);
          else if (a) drawGuideHand(ctx, T, a.x + 8, a.y + 8);
        }
      },
    };
  },
};
