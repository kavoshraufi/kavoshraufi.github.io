import {
  TAU, clamp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawHeartPath, playSfx, playNote, bgPoint,
} from '../core.js';

export const level10 = {
  id: 'bakery',
  shortTitle: 'Bageri',
  title: 'Lilla Bagaren',
  icon: '🎂',
  bg: 'bageri',
  tint: '#e8d7bc',
  goalTotal: 4,
  goalIcon: '🎂',
  bookDesc: 'Nila & Norins festtårtor som delades med alla skogens vänner!',

  create(api) {
    const ICINGS = [
      { id: 'cake-pink', color: '#ff8db4' },
      { id: 'cake-blue', color: '#7cc6f5' },
      { id: 'cake-yellow', color: '#ffd452' },
    ];

    const s = {
      idleT: 0,
      served: 0,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      cake: { stage: 0, icing: null, berry: false, star: false, bounce: 0, x: 0, y: 0 },
      dragCake: false,
      guests: [
        { id: 'butterfly', got: false, cakeSprite: null, x: 0, y: 0, hop: 0 },
        { id: 'ladybug', got: false, cakeSprite: null, x: 0, y: 0, hop: 0 },
        { id: 'bird', got: false, cakeSprite: null, x: 0, y: 0, hop: 0 },
        { id: 'bear', got: false, cakeSprite: null, x: 0, y: 0, hop: 0 },
      ],
      btns: [],
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      if (land) {
        // Gäster med fötterna på diskens framkant, tårtfatet på det målade glasstället.
        const gxs = [145, 220, 490, 575];
        s.guests.forEach((g, i) => {
          const p = bgPoint(W, H, 'bageri', gxs[i], 298);
          g.x = p.x; g.y = p.y;
        });
        const st = bgPoint(W, H, 'bageri', 360, 248);
        s.standX = st.x;
        s.standY = st.y;
        if (!s.dragCake) {
          s.cake.x = s.standX;
          s.cake.y = s.standY - 12;
        }
        // Brickan på skåpsfronten, med luft till titelraden under.
        const trayY = pr.y + pr.h * 0.80;
        const trayXs = [0.28, 0.38, 0.48, 0.58, 0.68, 0.78];
        s.btns = [
          { kind: 'base', sprite: 'cake-base', x: pr.x + pr.w * trayXs[0], y: trayY },
          { kind: 'icing', sprite: 'cake-pink', color: '#ff8db4', x: pr.x + pr.w * trayXs[1], y: trayY },
          { kind: 'icing', sprite: 'cake-blue', color: '#7cc6f5', x: pr.x + pr.w * trayXs[2], y: trayY },
          { kind: 'icing', sprite: 'cake-yellow', color: '#ffd452', x: pr.x + pr.w * trayXs[3], y: trayY },
          { kind: 'berry', sprite: 'berry', x: pr.x + pr.w * trayXs[4], y: trayY },
          { kind: 'star', sprite: 'star', x: pr.x + pr.w * trayXs[5], y: trayY },
        ];
        s.heroPos = [pr.x + pr.w * 0.04, pr.y + pr.h * 0.86];
        s.buddyPos = [pr.x + pr.w * 0.96, pr.y + pr.h * 0.86];
      } else {
        const gxs = [0.18, 0.40, 0.60, 0.82];
        const gy = pr.y + pr.h * 0.30;
        s.guests.forEach((g, i) => {
          g.x = pr.x + pr.w * gxs[i];
          g.y = gy;
        });
        s.standX = pr.x + pr.w * 0.50;
        s.standY = pr.y + pr.h * 0.60;
        if (!s.dragCake) {
          s.cake.x = s.standX;
          s.cake.y = s.standY - 12;
        }
        const trayY = pr.y + pr.h * 0.76;
        const trayXs = [0.15, 0.29, 0.43, 0.57, 0.71, 0.85];
        s.btns = [
          { kind: 'base', sprite: 'cake-base', x: pr.x + pr.w * trayXs[0], y: trayY },
          { kind: 'icing', sprite: 'cake-pink', color: '#ff8db4', x: pr.x + pr.w * trayXs[1], y: trayY },
          { kind: 'icing', sprite: 'cake-blue', color: '#7cc6f5', x: pr.x + pr.w * trayXs[2], y: trayY },
          { kind: 'icing', sprite: 'cake-yellow', color: '#ffd452', x: pr.x + pr.w * trayXs[3], y: trayY },
          { kind: 'berry', sprite: 'berry', x: pr.x + pr.w * trayXs[4], y: trayY },
          { kind: 'star', sprite: 'star', x: pr.x + pr.w * trayXs[5], y: trayY },
        ];
        s.heroPos = [pr.x + pr.w * 0.22, pr.y + pr.h * 0.90];
        s.buddyPos = [pr.x + pr.w * 0.78, pr.y + pr.h * 0.90];
      }
      return pr;
    }

    function applyAction(b) {
      if (b.kind === 'base') {
        if (s.cake.stage === 0) {
          s.cake.stage = 1;
          s.cake.bounce = 1;
          playSfx('pop');
          api.particles.burst(s.standX, s.standY - 26, 10, { colors: ['#ffe8a8', '#ffffff'] });
        }
      } else if (b.kind === 'icing') {
        if (s.cake.stage === 0) s.cake.stage = 1; // hjälper snällt igång botten direkt!
        s.cake.stage = Math.max(2, s.cake.stage);
        s.cake.icing = b.sprite;
        s.cake.bounce = 1;
        playSfx('ok');
        playNote(1, 0.28);
        api.particles.burst(s.standX, s.standY - 28, 12, { colors: [b.color, '#ffffff'] });
      } else if (b.kind === 'berry') {
        if (s.cake.stage < 2) { s.cake.stage = 2; s.cake.icing = 'cake-pink'; }
        s.cake.berry = true;
        s.cake.bounce = 1;
        playSfx('pling');
        api.particles.burst(s.standX, s.standY - 34, 10, { colors: ['#ff688c', '#ffe17a'] });
      } else if (b.kind === 'star') {
        if (s.cake.stage < 2) { s.cake.stage = 2; s.cake.icing = 'cake-yellow'; }
        s.cake.star = true;
        s.cake.bounce = 1;
        playSfx('star');
        api.particles.burst(s.standX, s.standY - 36, 12, { kind: 'star' });
      }
      s.heroExpr = 'forvanad';
      s.heroExprT = 0.6;
    }

    function serveGuest(g) {
      if (g.got || s.cake.stage < 2) return;
      g.got = true;
      g.cakeSprite = s.cake.icing || 'cake-pink';
      g.hop = 1;
      s.dragCake = false;
      s.cake = { stage: 0, icing: null, berry: false, star: false, bounce: 0, x: s.standX, y: s.standY - 12 };
      s.served++;
      playSfx('heart');
      playNote(s.served + 1, 0.38);
      s.heroExpr = 'skratt';
      s.heroExprT = 1.1;
      s.heroJump = 1;
      s.buddyJump = 1;
      api.particles.burst(g.x, g.y - 24, 18, { kind: 'heart', colors: ['#ff88aa', '#ffe17a', '#ffffff'] });
      api.setProgress(s.served);
      if (s.served >= s.guests.length) {
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
        if (s.cake.bounce > 0) s.cake.bounce = Math.max(0, s.cake.bounce - dt * 4);
        for (const g of s.guests) if (g.hop > 0) g.hop = Math.max(0, g.hop - dt * 2.4);
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;

        // 1. Ta tag i färdig tårta på fatet
        if (s.cake.stage >= 2 && dist(x, y, s.cake.x, s.cake.y - 18) < 52) {
          s.dragCake = true;
          playSfx('ok');
          return;
        }

        // 2. Tryck direkt på väntande gäst om tårtan är klar!
        if (s.cake.stage >= 2) {
          for (const g of s.guests) {
            if (!g.got && dist(x, y, g.x, g.y - 22) < 52) {
              serveGuest(g);
              return;
            }
          }
        }

        // 3. Bakverktyg/ingredienser i brickan
        for (const b of s.btns) {
          if (dist(x, y, b.x, b.y) < 36) {
            applyAction(b);
            return;
          }
        }

        // 4. Tryck direkt på tomt tårtfat → lägger botten direkt!
        if (s.cake.stage === 0 && dist(x, y, s.standX, s.standY - 12) < 54) {
          applyAction(s.btns[0]);
          return;
        }

        // 5. Systrarna
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
        if (!s.dragCake) return;
        s.cake.x = x;
        s.cake.y = y;
      },

      onUp() {
        if (!s.dragCake) return;
        s.dragCake = false;
        for (const g of s.guests) {
          if (!g.got && dist(s.cake.x, s.cake.y - 16, g.x, g.y - 22) < 68) {
            serveGuest(g);
            return;
          }
        }
        s.cake.x = s.standX;
        s.cake.y = s.standY - 12;
      },

      draw(ctx, T, W, H) {
        const pr = layout(W, H);

        // Djurgäster vid bageridiset
        for (const g of s.guests) {
          const readyToServe = s.cake.stage >= 2 && !g.got;
          if (readyToServe) drawGlowRing(ctx, T, g.x, g.y - 24, 38, 'rgba(255, 224, 112, 0.78)');
          const bob = g.hop > 0 ? -Math.sin(g.hop * Math.PI) * 18 : Math.sin(T * 2.5 + g.x) * 2;
          drawShadow(ctx, g.x, g.y + 4, 24, 6);
          const guestH = { butterfly: 54, ladybug: 46, bird: 62, bear: 66 };
          blit(ctx, g.id, g.x, g.y + bob, { h: guestH[g.id] || 58 });
          if (g.got) {
            blit(ctx, g.cakeSprite, g.x + 24, g.y + 10, { h: 36 });
            ctx.save();
            ctx.translate(g.x, g.y - 70 + Math.sin(T * 3 + g.x) * 4);
            ctx.fillStyle = '#ff7da4';
            drawHeartPath(ctx, 9);
            ctx.fill();
            ctx.restore();
          }
        }

        // Tårtfat i mitten
        if (!api.won) {
          drawShadow(ctx, s.standX, s.standY + 6, 46, 11);
          ctx.save();
          ctx.fillStyle = '#fff9ec';
          ctx.strokeStyle = '#c49d68';
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.ellipse(s.standX, s.standY, 48, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
        }

        // Ingrediensbricka (när banan inte är klar)
        if (!api.won) {
          for (const b of s.btns) {
            ctx.save();
            ctx.fillStyle = 'rgba(253, 247, 234, 0.92)';
            ctx.strokeStyle = 'rgba(154, 118, 66, 0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.restore();
            blit(ctx, b.sprite, b.x, b.y + 16, { h: 34 });
          }
        }

        // Båda systrarna
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.0 : 1.14;
        if (api.won) {
          const d1 = api.gladjedans(T);
          const d2 = api.gladjedans(T + 0.5);
          drawHero(ctx, T, W * 0.43, pr.y + pr.h * 0.74, { ...d1, who: leadId, scale: heroScale, face: 1 });
          drawHero(ctx, T, W * 0.57, pr.y + pr.h * 0.74, { ...d2, who: buddyId, scale: heroScale, face: -1 });
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

        // Tårtan under bakning / dragning
        if (!api.won && s.cake.stage >= 1) {
          const sc = (s.dragCake ? 1.14 : 1) + Math.sin(s.cake.bounce * Math.PI) * 0.16;
          const sp = s.cake.icing || 'cake-base';
          blit(ctx, sp, s.cake.x, s.cake.y + 12, { h: 68 * sc });
          if (s.cake.berry) blit(ctx, 'berry', s.cake.x - 12, s.cake.y - 26, { h: 24 * sc });
          if (s.cake.star) blit(ctx, 'star', s.cake.x + 12, s.cake.y - 28, { h: 26 * sc });
        }

        // Pekhand
        if (!api.won && (s.served === 0 || s.idleT > 2.8)) {
          if (s.cake.stage === 0) {
            drawGuideHand(ctx, T, s.btns[0].x, s.btns[0].y, s.standX, s.standY - 12);
          } else if (s.cake.stage === 1) {
            drawGuideHand(ctx, T, s.btns[1].x, s.btns[1].y);
          } else if (!s.dragCake) {
            const g = s.guests.find((x) => !x.got);
            if (g) drawGuideHand(ctx, T, s.cake.x, s.cake.y - 16, g.x, g.y - 20);
          }
        }
      },
    };
  },
};
