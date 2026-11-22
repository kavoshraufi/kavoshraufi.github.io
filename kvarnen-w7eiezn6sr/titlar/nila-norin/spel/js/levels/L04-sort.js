import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawBasket, drawStarPath, playSfx, playNote,
} from '../core.js';

export const level04 = {
  id: 'sort',
  shortTitle: 'Sortera',
  title: 'Sorteringsstugan',
  art: 'korg',
  bg: 'stuga',
  tint: '#d9c29c',
  goalTotal: 5,
  rounds: 4,
  goalFor: (r) => [6, 7, 8, 9][Math.min(3, r - 1)],
  goalArt: 'korg',
  bookDesc: 'Skogsvännerna knackade på och fick precis det de önskade sig!',

  create(api) {
    const GROUPS = [
      { id: 'gold', color: '#f3c14b', label: 'Guld', kind: 'star' },
      { id: 'pink', color: '#eb6e8a', label: 'Bär', kind: 'berry' },
      { id: 'brown', color: '#8f643c', label: 'Ekollon', kind: 'acorn' },
    ];

    // 1.9: ny kärnverb — VÄLJ RÄTT. Skogsvänner knackar på stugans fönster och önskar sig något
    // (visas i en pratbubbla). Barnet trycker på rätt sak på mattan; systrarna skickar iväg den i en båge.
    const R = api.round || 1;
    const N = [6, 7, 8, 9][Math.min(3, R - 1)];
    const TVA = R >= 3; // från runda 3 önskar vännerna sig två olika saker
    const VANNER = ['owl', 'hedge', 'bunny', 'fox', 'bear', 'bird', 'owl-baby'];
    const s = {
      idleT: 0,
      sorted: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      inited: false,
      baskets: GROUPS.map((g, i) => ({ ...g, i, x: 0, y: 0, count: 0, bounce: 0 })),
      items: [],
      wish: null,        // { group, friend, popT }
      flying: null,      // { it, t, ax, ay, bx, by }
      wiggle: null, dragging: null, downX: 0, downY: 0,
      friendIdx: (R - 1) * 2,
      winBirdT: 0,
    };

    // Mattan: alla tre sorterna blandade, ett par extra så det finns att välja på
    const order = ['gold', 'pink', 'brown', 'pink', 'brown', 'gold', 'brown', 'gold', 'pink', 'gold', 'brown'];
    order.slice(0, N + 2).forEach((gid, idx) => {
      const g = GROUPS.find((x) => x.id === gid);
      s.items.push({ id: idx, group: gid, kind: g.kind, color: g.color, x: 0, y: 0, done: false, bob: 0 });
    });

    function nyOnskan() {
      const kvar = s.items.filter((x) => !x.done);
      if (!kvar.length) return;
      // Snäll variation: inte samma sort två gånger i rad om det går
      const prev = s.wish ? s.wish.last : null;
      const val = kvar.find((x) => x.group !== prev) || kvar[0];
      const groups = [val.group];
      const behov = N - s.sorted;
      if (TVA && behov >= 2) {
        const andra = kvar.find((x) => x.group !== val.group);
        if (andra) groups.push(andra.group);
      }
      s.wish = { groups, group: groups[0], last: groups[groups.length - 1], friend: VANNER[s.friendIdx % VANNER.length], popT: 1 };
      s.friendIdx++;
      playSfx('pling');
    }
    nyOnskan();

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      s.baskets.forEach((b, i) => {
        b.x = pr.x + pr.w * (land ? (0.46 + i * 0.17) : (0.42 + i * 0.2));
        b.y = pr.y + pr.h * (land ? 0.40 : 0.36);
      });
      const cols = Math.ceil(s.items.length / 2);
      s.items.forEach((it, idx) => {
        if (it.done || s.dragging === it) return;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const rx = land ? (0.24 + col * (0.52 / Math.max(1, cols - 1)) + row * 0.04) : (0.18 + col * (0.64 / Math.max(1, cols - 1)));
        const ry = land ? (0.68 + row * 0.16) : (0.58 + row * 0.13);
        it.x = pr.x + pr.w * rx;
        it.y = pr.y + pr.h * ry;
      });
      s.heroPos = [pr.x + pr.w * (land ? 0.08 : 0.14), pr.y + pr.h * (land ? 0.84 : 0.90)];
      s.buddyPos = [pr.x + pr.w * (land ? 0.92 : 0.86), pr.y + pr.h * (land ? 0.84 : 0.90)];
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

    function skicka(it) {
      const b = s.baskets.find((k) => k.id === it.group);
      it.done = true;
      s.flying = { it, t: 0, ax: it.x, ay: it.y, bx: b.x, by: b.y - 10, b };
      s.heroJump = 0.6; s.heroExpr = 'skratt'; s.heroExprT = 0.7;
      playSfx('whoosh');
    }

    function landat(f) {
      const b = f.b;
      b.count++;
      b.bounce = 1;
      s.sorted++;
      s.buddyJump = 0.8;
      playSfx('heart');
      playNote(s.sorted - 1, 0.32);
      api.particles.burst(b.x, b.y - 12, 14, { kind: 'heart', colors: [b.color, '#ffe17a', '#ffffff'] });
      api.setProgress(s.sorted);
      s.flying = null;
      if (s.sorted >= N) api.win();
      else if (!s.wish || !s.wish.groups.length) nyOnskan();
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
        if (s.wish && s.wish.popT > 0) s.wish.popT = Math.max(0, s.wish.popT - dt * 2.5);
        if (s.wiggle) { s.wiggle.t -= dt; if (s.wiggle.t <= 0) s.wiggle = null; }
        for (const b of s.baskets) if (b.bounce > 0) b.bounce = Math.max(0, b.bounce - dt * 4);
        if (s.flying) { s.flying.t += dt * 2.4; if (s.flying.t >= 1) landat(s.flying); }
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Tryck eller dra en sak på mattan
        if (!s.flying && s.wish) {
          for (const it of s.items) {
            if (!it.done && dist(x, y, it.x, it.y) < 36) {
              s.dragging = it;
              s.downX = x; s.downY = y;
              playSfx('ok');
              return;
            }
          }
        }

        // 2. Korgarna studsar och spelar sin ton
        for (const b of s.baskets) {
          if (dist(x, y, b.x, b.y) < 46) {
            b.bounce = 1;
            playNote(b.i * 2, 0.3);
            api.particles.burst(b.x, b.y - 20, 8, { kind: 'star', colors: [b.color, '#ffffff'] });
            return;
          }
        }

        // 3. Vännen i fönstret vinkar
        if (s.winPos && dist(x, y, s.winPos[0], s.winPos[1]) < 56) {
          s.winBirdT = 1;
          if (s.wish) s.wish.popT = 1;
          playSfx('pling'); playNote(s.friendIdx % 6, 0.32);
          api.particles.burst(s.winPos[0], s.winPos[1], 12, { kind: 'heart' });
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
        const quickTap = dist(x, y, s.downX, s.downY) < 22;
        const nearTarget = s.baskets.some((b) => dist(x, y, b.x, b.y) < 62) || (s.winPos && dist(x, y, s.winPos[0], s.winPos[1]) < 80);
        const gi = s.wish ? s.wish.groups.indexOf(it.group) : -1;
        if (gi >= 0 && (quickTap || nearTarget)) {
          s.wish.groups.splice(gi, 1);
          s.wish.group = s.wish.groups[0] || null;
          skicka(it);
        } else if (gi < 0 && (quickTap || nearTarget)) {
          s.wiggle = { it, t: 0.45 };
          if (s.wish) s.wish.popT = 1;
          playSfx('softno');
        }
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Korgar
        for (const b of s.baskets) {
          const sc = 1 + Math.sin(b.bounce * Math.PI) * 0.2;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.scale(sc, 2 - sc);
          drawBasket(ctx, 0, 0, 32, b.color, (c) => drawBasketBadge(c, b, 0, 0, 32));
          ctx.restore();
        }

        // Vännen i fönstret med sin önskebubbla
        if (s.wish && s.winPos) {
          const [wx, wy] = s.winPos;
          const pop = 1 + Math.sin(s.wish.popT * Math.PI) * 0.18;
          blit(ctx, s.wish.friend, wx, wy + 30 - Math.sin(T * 2.2) * 3 - s.winBirdT * 8, { h: 60 });
          const bx = wx + 66, by = wy - 22;
          ctx.save();
          ctx.translate(bx, by);
          ctx.scale(pop, pop);
          ctx.fillStyle = 'rgba(255, 252, 240, 0.96)';
          ctx.strokeStyle = 'rgba(122, 86, 40, 0.55)';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(0, 0, 32, 27, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(-30, 20, 6, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(-40, 30, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
          const gs = s.wish.groups;
          gs.forEach((gid, k) => {
            const g = GROUPS.find((x) => x.id === gid);
            drawTreasure(ctx, { kind: g.kind }, gs.length > 1 ? (k ? 13 : -13) : 0, -2, gs.length > 1 ? 0.72 : 0.95);
          });
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

        // Saker på mattan
        for (const it of s.items) {
          if (it.done) continue;
          const w = s.wiggle && s.wiggle.it === it ? Math.sin(s.wiggle.t * 40) * 6 : 0;
          drawTreasure(ctx, it, it.x + w, it.y, s.dragging === it ? 1.18 : 1);
        }
        // Saken i luften
        if (s.flying) {
          const f = s.flying, k = Math.min(1, f.t);
          const fx = f.ax + (f.bx - f.ax) * k;
          const fy = f.ay + (f.by - f.ay) * k - Math.sin(k * Math.PI) * 70;
          drawTreasure(ctx, f.it, fx, fy, 1.1 - k * 0.3);
        }

        // Pekhand: en sak som vännen önskar sig
        if (!api.won && !s.flying && s.wish && s.wish.group && (s.sorted === 0 || s.idleT > 2.2)) {
          const it = s.items.find((x) => !x.done && x.group === s.wish.group);
          if (it) drawGuideHand(ctx, T, it.x + 6, it.y + 6);
        }
      },
    };
  },
};
