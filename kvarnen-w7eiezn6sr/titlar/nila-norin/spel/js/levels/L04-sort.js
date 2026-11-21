import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawBasket, drawStarPath, playSfx, playNote,
} from '../core.js';

export const level04 = {
  id: 'sort',
  shortTitle: 'Sortera',
  title: 'Sorteringsstugan',
  icon: '🧺',
  bg: 'stuga',
  tint: '#d9c29c',
  goalTotal: 9,
  goalIcon: '🧺',
  bookDesc: 'Välstädade skogskorgar fulla av stjärnor, bär och ekollon!',

  create(api) {
    const GROUPS = [
      { id: 'gold', color: '#f3c14b', label: 'Guld', kind: 'star' },
      { id: 'pink', color: '#eb6e8a', label: 'Bär', kind: 'berry' },
      { id: 'brown', color: '#8f643c', label: 'Ekollon', kind: 'acorn' },
    ];

    const s = {
      idleT: 0,
      sorted: 0,
      dragging: null,
      selected: null,
      downX: 0,
      downY: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      winBirdT: 0,
      inited: false,
      baskets: GROUPS.map((g, i) => ({ ...g, i, x: 0, y: 0, count: 0, bounce: 0 })),
      items: [],
    };

    // 9 skatter utspridda på mattan
    const order = ['gold', 'pink', 'brown', 'pink', 'brown', 'gold', 'brown', 'gold', 'pink'];
    order.forEach((gid, idx) => {
      const g = GROUPS.find((x) => x.id === gid);
      s.items.push({
        id: idx,
        group: gid,
        kind: g.kind,
        color: g.color,
        x: 0, y: 0, homeX: 0, homeY: 0,
        done: false,
        rx: 0, ry: 0,
      });
    });

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      s.baskets.forEach((b, i) => {
        b.x = pr.x + pr.w * (land ? (0.28 + i * 0.22) : (0.22 + i * 0.28));
        b.y = pr.y + pr.h * (land ? 0.36 : 0.34);
      });
      s.items.forEach((it, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const rx = land ? (0.29 + col * 0.20 + (row % 2) * 0.04) : (0.22 + col * 0.28);
        const ry = land ? (0.64 + row * 0.13) : (0.54 + row * 0.12);
        it.homeX = pr.x + pr.w * rx;
        it.homeY = pr.y + pr.h * ry;
        if (!s.inited || (!it.done && s.dragging !== it)) {
          it.x = it.homeX;
          it.y = it.homeY;
        }
      });
      s.heroPos = [pr.x + pr.w * (land ? 0.11 : 0.18), pr.y + pr.h * (land ? 0.80 : 0.88)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.89 : 0.82), pr.y + pr.h * (land ? 0.80 : 0.88)];
      s.winPos = [pr.x + pr.w * (land ? 0.27 : 0.28), pr.y + pr.h * (land ? 0.28 : 0.16)];
      s.inited = true;
      return pr;
    }

    function drawTreasure(ctx, it, x, y, sc = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      drawShadow(ctx, 0, 12, 16, 5, 0.22);
      if (it.kind === 'star') {
        ctx.fillStyle = '#ffd554';
        ctx.strokeStyle = '#b47418';
        ctx.lineWidth = 2;
        drawStarPath(ctx, 5, 18, 8);
        ctx.fill(); ctx.stroke();
      } else if (it.kind === 'berry') {
        blit(ctx, 'berry', 0, 18, { h: 36 });
      } else {
        // Akvarell-ekollon
        ctx.fillStyle = '#c88c4c';
        ctx.strokeStyle = '#5c3c1e';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 2, 12, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#734b28';
        ctx.beginPath(); ctx.ellipse(0, -8, 14, 8, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(2, -21); ctx.stroke();
      }
      ctx.restore();
    }

    function drawBasketBadge(ctx, g, bx, by, br) {
      drawTreasure(ctx, { kind: g.kind }, bx, by + br * 0.14, 0.62);
    }

    function placeInBasket(it, b) {
      it.done = true;
      s.dragging = null;
      s.selected = null;
      b.count++;
      b.bounce = 1;
      s.sorted++;
      s.heroExpr = 'skratt';
      s.heroExprT = 0.9;
      s.heroJump = 0.7;
      s.buddyJump = 0.6;
      playSfx('ok');
      playNote(s.sorted - 1, 0.32);
      api.particles.burst(b.x, b.y - 12, 14, { kind: 'star', colors: [b.color, '#ffe17a', '#ffffff'] });
      api.setProgress(s.sorted);
      if (s.sorted >= s.items.length) {
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
        if (s.winBirdT > 0) s.winBirdT = Math.max(0, s.winBirdT - dt * 1.4);
        for (const b of s.baskets) if (b.bounce > 0) b.bounce = Math.max(0, b.bounce - dt * 4);
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;
        s.downX = x; s.downY = y;

        // 1. Ta tag i en skatt på mattan
        for (let i = s.items.length - 1; i >= 0; i--) {
          const it = s.items[i];
          if (!it.done && dist(x, y, it.x, it.y) < 34) {
            s.dragging = it;
            s.selected = it;
            playSfx('tap');
            return;
          }
        }

        // 2. Om en skatt är vald med dutt → tryck på korg!
        if (s.selected && !s.selected.done) {
          for (const b of s.baskets) {
            if (dist(x, y, b.x, b.y) < 56) {
              if (b.id === s.selected.group) {
                placeInBasket(s.selected, b);
              } else {
                playSfx('softno');
                const right = s.baskets.find((k) => k.id === s.selected.group);
                if (right) api.particles.burst(right.x, right.y - 16, 8, { kind: 'star' });
              }
              return;
            }
          }
        }

        // 3. Fönsterfågel
        if (s.winPos && dist(x, y, s.winPos[0], s.winPos[1]) < 60) {
          s.winBirdT = 1;
          playSfx('pling');
          api.particles.burst(s.winPos[0], s.winPos[1], 12, { kind: 'star' });
          return;
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
        s.dragging.x = x;
        s.dragging.y = y;
      },

      onUp(x, y) {
        if (!s.dragging) return;
        const it = s.dragging;
        s.dragging = null;
        for (const b of s.baskets) {
          if (dist(it.x, it.y, b.x, b.y) < 68) {
            if (b.id === it.group) {
              placeInBasket(it, b);
              return;
            }
            playSfx('softno');
            it.x = it.homeX; it.y = it.homeY;
            return;
          }
        }
        if (dist(x, y, s.downX, s.downY) >= 18) {
          it.x = it.homeX; it.y = it.homeY;
        } else {
          // Dutt → stanna vald för enkel 2-tryckssortering!
          it.x = it.homeX; it.y = it.homeY;
        }
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);
        const active = s.dragging || s.selected;

        // Korgar med färg & tydlig bildikon
        for (const b of s.baskets) {
          const match = active && active.group === b.id;
          if (match) drawGlowRing(ctx, T, b.x, b.y, 44, b.color);
          const sc = 1 + Math.sin(b.bounce * Math.PI) * 0.2;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.scale(sc, 2 - sc);
          drawBasket(ctx, 0, 0, 34, b.color, (c) => drawBasketBadge(c, b, 0, 0, 34));
          ctx.restore();
        }

        // Fönsterfågel vid tryck på fönstret
        if (s.winBirdT > 0 && s.winPos) {
          blit(ctx, 'bird', s.winPos[0], s.winPos[1] + 20 - Math.sin(s.winBirdT * Math.PI) * 18, { h: 48 });
        }

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.15;
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

        // Skatter på mattan
        for (const it of s.items) {
          if (it.done) continue;
          const isHeld = s.dragging === it || s.selected === it;
          if (isHeld) drawGlowRing(ctx, T, it.x, it.y, 26, it.color);
          drawTreasure(ctx, it, it.x, it.y + (isHeld ? -6 : 0), isHeld ? 1.18 : 1);
        }

        // Pekhand
        if (!api.won && (s.sorted === 0 || s.idleT > 2.8)) {
          const nextIt = active || s.items.find((x) => !x.done);
          if (nextIt) {
            const b = s.baskets.find((k) => k.id === nextIt.group);
            if (b) drawGuideHand(ctx, T, nextIt.x, nextIt.y, b.x, b.y);
          }
        }
      },
    };
  },
};
