import {
  TAU, clamp, dist,
  drawHero, drawGlowRing, drawGuideHand,
  drawStarPath, playSfx, playNote,
} from '../core.js';

export const level08 = {
  id: 'stars',
  shortTitle: 'Stjärnor',
  title: 'Stjärnhimlen',
  icon: '🌟',
  bg: 'natt',
  tint: '#1c2b4a',
  goalTotal: 4,
  goalIcon: '🌟',
  bookDesc: 'Lysande stjärnbilder ritade av Nila & Norin i natthimlen!',

  create(api) {
    const CONSTELLATIONS = [
      {
        name: 'Krona', icon: '👑',
        pts: [[0.30, 0.56], [0.38, 0.28], [0.50, 0.44], [0.62, 0.28], [0.70, 0.56]],
        close: true,
      },
      {
        name: 'Hjärta', icon: '💖',
        pts: [[0.50, 0.62], [0.32, 0.40], [0.40, 0.24], [0.50, 0.34], [0.60, 0.24], [0.68, 0.40]],
        close: true,
      },
      {
        name: 'Fjäril', icon: '🦋',
        pts: [[0.50, 0.45], [0.32, 0.26], [0.34, 0.58], [0.50, 0.45], [0.68, 0.26], [0.66, 0.58]],
        close: false,
      },
      {
        name: 'Stjärna', icon: '✨',
        pts: [[0.50, 0.20], [0.64, 0.60], [0.30, 0.36], [0.70, 0.36], [0.36, 0.60]],
        close: true,
      },
    ];

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
      doneIcons: [],
      skyPts: [],
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
      s.heroPos = [pr.x + pr.w * (land ? 0.16 : 0.28), pr.y + pr.h * (land ? 0.90 : 0.86)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.84 : 0.72), pr.y + pr.h * (land ? 0.90 : 0.86)];
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
        s.doneIcons.push({ icon: cur.icon, name: cur.name });
        s.stage++;
        s.connected = 0;
        playSfx('pling');
        s.heroExpr = 'skratt';
        s.heroExprT = 1.1;
        s.heroJump = 1;
        s.buddyJump = 1;
        api.setProgress(s.stage);
        if (s.stage >= CONSTELLATIONS.length) {
          api.win(3);
        }
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
        s.doneIcons.forEach((d, idx) => {
          const ix = pr.x + pr.w * (0.24 + idx * 0.17);
          const iy = pr.y + 24 + Math.sin(T * 2 + idx) * 4;
          ctx.save();
          ctx.font = '26px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(d.icon, ix, iy);
          ctx.restore();
        });

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
            ctx.strokeStyle = '#ffe272';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = '#ffe272';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            for (let i = 0; i < s.connected; i++) {
              const p = s.skyPts[i];
              if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
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

        // Båda systrarna på kullen
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.12;
        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.82, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.82, { ...d2, who: buddyId, scale: heroScale, face: -1 });
        } else {
          drawHero(ctx, T, s.heroPos[0], s.heroPos[1], {
            who: leadId, scale: heroScale, expr: s.heroExpr,
            pose: s.heroJump > 0 ? 'jump' : 'idle',
            bob: s.heroJump > 0 ? -Math.sin(s.heroJump * Math.PI) * 26 : 0, face: 1,
          });
          drawHero(ctx, T, s.buddyPos[0], s.buddyPos[1], {
            who: buddyId, scale: heroScale * 0.9,
            expr: s.buddyJump > 0 ? 'skratt' : 'glad',
            pose: s.buddyJump > 0 ? 'jump' : 'cheer',
            bob: s.buddyJump > 0 ? -Math.sin(s.buddyJump * Math.PI) * 24 : 0, face: -1,
          });
        }

        // Pekhand
        if (!api.won && (s.stage === 0 && s.connected === 0 || s.idleT > 2.6)) {
          const a = s.skyPts[s.connected];
          const b = s.skyPts[s.connected + 1];
          if (a && b && s.connected > 0) drawGuideHand(ctx, T, s.skyPts[s.connected - 1].x, s.skyPts[s.connected - 1].y, a.x, a.y);
          else if (a) drawGuideHand(ctx, T, a.x + 8, a.y + 8);
        }
      },
    };
  },
};
