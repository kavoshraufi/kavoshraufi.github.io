import {
  TAU, clamp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawStarPath, playSfx, playNote,
} from '../core.js';

export const level09 = {
  id: 'treasure',
  shortTitle: 'Skatt',
  title: 'Skattjakten',
  icon: '🗝️',
  bg: 'borggard',
  tint: '#d9ccb2',
  goalTotal: 3,
  goalIcon: '🗝️',
  bookDesc: 'Tre formnycklar som låste upp krona, nalle och speldosa!',

  create(api) {
    const s = {
      idleT: 0,
      opened: 0,
      dragging: null,
      selected: null,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      inited: false,
      pairs: [
        { id: 'circle', chestSprite: 'chest-circle', color: '#f08b49', toy: '👑', hideKind: 'pot', hid: true, open: false, kx: 0, ky: 0, hx: 0, hy: 0, cx: 0, cy: 0, popT: 0 },
        { id: 'tri', chestSprite: 'chest-tri', color: '#58b878', toy: '🧸', hideKind: 'roses', hid: true, open: false, kx: 0, ky: 0, hx: 0, hy: 0, cx: 0, cy: 0, popT: 0 },
        { id: 'star', chestSprite: 'chest-star', color: '#f3c63f', toy: '🔔', hideKind: 'arch', hid: true, open: false, kx: 0, ky: 0, hx: 0, hy: 0, cx: 0, cy: 0, popT: 0 },
      ],
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      const chestXs = land ? [0.27, 0.50, 0.73] : [0.23, 0.50, 0.77];
      const chestY = pr.y + pr.h * (land ? 0.43 : 0.38);
      const hideXs = land ? [0.22, 0.50, 0.78] : [0.24, 0.50, 0.76];
      const hideY = pr.y + pr.h * (land ? 0.74 : 0.66);

      s.pairs.forEach((p, i) => {
        p.cx = pr.x + pr.w * chestXs[i];
        p.cy = chestY;
        p.hx = pr.x + pr.w * hideXs[i];
        p.hy = hideY;
        if (!s.inited || (!p.open && s.dragging !== p)) {
          p.kx = p.hx;
          p.ky = p.hy - 26;
        }
      });
      s.heroPos = [pr.x + pr.w * (land ? 0.10 : 0.20), pr.y + pr.h * (land ? 0.80 : 0.88)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.90 : 0.80), pr.y + pr.h * (land ? 0.80 : 0.88)];
      s.inited = true;
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
      s.dragging = null;
      s.selected = null;
      s.opened++;
      playSfx('open');
      playNote(s.opened * 2 - 1, 0.38);
      s.heroExpr = 'skratt';
      s.heroExprT = 1.1;
      s.heroJump = 1;
      s.buddyJump = 0.9;
      api.particles.burst(p.cx, p.cy - 24, 18, { kind: 'star', colors: [p.color, '#ffe17a', '#ffffff'] });
      api.setProgress(s.opened);
      if (s.opened >= s.pairs.length) {
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
        for (const p of s.pairs) if (p.popT > 0) p.popT = Math.max(0, p.popT - dt * 2.5);
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Öppen nyckel → ta tag i
        for (const p of s.pairs) {
          if (!p.hid && !p.open && dist(x, y, p.kx, p.ky) < 42) {
            s.dragging = p;
            s.selected = p;
            playSfx('ok');
            return;
          }
        }

        // 2. Gömställe → avslöja formnyckel!
        for (const p of s.pairs) {
          if (p.hid && dist(x, y, p.hx, p.hy - 18) < 52) {
            p.hid = false;
            p.kx = p.hx;
            p.ky = p.hy - 32;
            playSfx('star');
            s.heroExpr = 'forvanad';
            s.heroExprT = 0.9;
            s.heroJump = 0.5;
            api.particles.burst(p.hx, p.hy - 22, 14, { kind: 'star', colors: [p.color, '#ffe17a'] });
            return;
          }
        }

        // 3. Kista (om nyckel är vald eller öppen skattleksak!)
        for (const p of s.pairs) {
          if (dist(x, y, p.cx, p.cy - 22) < 54) {
            if (p.open) {
              p.popT = 1;
              playNote(s.pairs.indexOf(p) * 2, 0.35);
              api.particles.burst(p.cx, p.cy - 44, 10, { kind: 'star' });
              return;
            }
            if (s.selected && !s.selected.hid && !s.selected.open) {
              if (s.selected === p) openChest(p);
              else playSfx('softno');
              return;
            }
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
        }
      },

      onMove(x, y) {
        if (!s.dragging) return;
        s.dragging.kx = x;
        s.dragging.ky = y;
      },

      onUp() {
        if (!s.dragging) return;
        const p = s.dragging;
        s.dragging = null;
        if (dist(p.kx, p.ky, p.cx, p.cy - 22) < 68) {
          openChest(p);
          return;
        }
        for (const other of s.pairs) {
          if (other !== p && dist(p.kx, p.ky, other.cx, other.cy - 22) < 60) {
            playSfx('softno');
            p.kx = p.hx; p.ky = p.hy - 32;
            return;
          }
        }
        p.kx = p.hx; p.ky = p.hy - 32;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);
        const active = s.dragging || s.selected;

        // Kistor uppe på borggården
        for (const p of s.pairs) {
          if (!p.open && active === p) {
            drawGlowRing(ctx, T, p.cx, p.cy - 24, 46, p.color);
          }
          drawShadow(ctx, p.cx, p.cy + 4, 30, 8);
          blit(ctx, p.open ? 'chest-open' : p.chestSprite, p.cx, p.cy, { h: 70 });
          if (!p.open) {
            drawShapeIcon(ctx, p.id, p.cx, p.cy - 72, 11, p.color);
          } else {
            const hop = Math.sin(T * 3.5 + p.cx) * 5 - Math.sin(p.popT * Math.PI) * 16;
            ctx.save();
            ctx.font = '32px system-ui, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.toy, p.cx, p.cy - 74 + hop);
            ctx.restore();
          }
        }

        // Gömställen (kruka, rosbuske, stenvalv) som vickar tydligt!
        for (const p of s.pairs) {
          if (!p.hid) continue;
          const wig = Math.sin(T * 4.2 + p.hx) * 0.07;
          ctx.save();
          ctx.translate(p.hx, p.hy);
          ctx.rotate(wig);
          drawGlowRing(ctx, T, 0, -20, 32, 'rgba(255, 224, 120, 0.55)');
          drawShadow(ctx, 0, 2, 24, 7);
          if (p.hideKind === 'pot') {
            ctx.fillStyle = '#cf7d4e'; ctx.strokeStyle = '#6f3e20'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.ellipse(0, -18, 22, 20, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#de9062';
            ctx.beginPath(); ctx.roundRect(-16, -38, 32, 9, 4); ctx.fill(); ctx.stroke();
          } else if (p.hideKind === 'roses') {
            ctx.strokeStyle = '#3b6a37'; ctx.lineWidth = 2;
            for (const [bx, by, br] of [[-14, -14, 16], [14, -14, 16], [0, -24, 20]]) {
              ctx.fillStyle = '#5eb05d'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke();
            }
            for (const [rx, ry] of [[-12, -22], [10, -24], [0, -12]]) {
              ctx.fillStyle = '#ff7ca8'; ctx.beginPath(); ctx.arc(rx, ry, 6, 0, TAU); ctx.fill();
            }
          } else {
            ctx.fillStyle = '#a8a298'; ctx.strokeStyle = '#5c564c'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.arc(0, -16, 26, Math.PI, TAU); ctx.lineTo(26, 0); ctx.lineTo(-26, 0); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#4f483f';
            ctx.beginPath(); ctx.arc(0, -12, 13, Math.PI, TAU); ctx.lineTo(13, 0); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.14;
        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.78, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.78, { ...d2, who: buddyId, scale: heroScale, face: -1 });
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

        // Framtagna formnycklar
        for (const p of s.pairs) {
          if (p.hid || p.open) continue;
          const held = s.dragging === p || s.selected === p;
          drawGlowRing(ctx, T, p.kx, p.ky, 26, p.color);
          drawShapeKey(ctx, p, p.kx, p.ky + (held ? -6 : Math.sin(T * 3 + p.hx) * 3), held ? 1.2 : 1);
        }

        // Pekhand
        if (!api.won && (s.opened === 0 || s.idleT > 2.8)) {
          const rev = s.pairs.find((p) => !p.hid && !p.open);
          if (rev && !s.dragging) {
            drawGuideHand(ctx, T, rev.kx, rev.ky, rev.cx, rev.cy - 24);
          } else {
            const h = s.pairs.find((p) => p.hid);
            if (h) drawGuideHand(ctx, T, h.hx + 8, h.hy - 18);
          }
        }
      },
    };
  },
};
