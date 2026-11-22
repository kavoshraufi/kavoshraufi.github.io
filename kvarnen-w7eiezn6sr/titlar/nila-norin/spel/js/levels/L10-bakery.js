import {
  TAU, clamp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawHeartPath, playSfx, playNote, bgPoint,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level10 = {
  id: 'bakery',
  shortTitle: 'Bageri',
  title: 'Lilla Bagaren',
  art: 'tarta',
  bg: 'bageri',
  tint: '#e8d7bc',
  goalTotal: 4,
  rounds: 3,
  goalArt: 'tarta',
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
      stage: createHeroStage(),
      // Rundor: nya hungriga skogsvänner köar vid disken varje runda.
      guests: [
        ['butterfly', 'ladybug', 'bird', 'bear'],
        ['fox', 'bunny', 'hedge', 'owl'],
        ['bunny-baby', 'fox-baby', 'owl-baby', 'hedge-baby'],
      ][((api.round || 1) - 1) % 3].map((id, i) => ({ id, got: false, cakeSprite: null, wantIcing: ICINGS[(i + (api.round || 1)) % 3].id, dream: false, x: 0, y: 0, hop: 0, leaving: false, leaveT: 0, leaveDir: i < 2 ? -1 : 1 })),
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
        const trayY = pr.y + pr.h * 0.84;
        const trayXs = [0.28, 0.38, 0.48, 0.58, 0.68, 0.78];
        s.btns = [
          { kind: 'base', sprite: 'cake-base', x: pr.x + pr.w * trayXs[0], y: trayY },
          { kind: 'icing', sprite: 'cake-pink', color: '#ff8db4', x: pr.x + pr.w * trayXs[1], y: trayY },
          { kind: 'icing', sprite: 'cake-blue', color: '#7cc6f5', x: pr.x + pr.w * trayXs[2], y: trayY },
          { kind: 'icing', sprite: 'cake-yellow', color: '#ffd452', x: pr.x + pr.w * trayXs[3], y: trayY },
          { kind: 'berry', sprite: 'berry', x: pr.x + pr.w * trayXs[4], y: trayY },
          { kind: 'star', sprite: 'star', x: pr.x + pr.w * trayXs[5], y: trayY },
        ];
        s.heroPos = [pr.x + pr.w * 0.08, pr.y + pr.h * 0.83];
        s.buddyPos = [pr.x + pr.w * 0.92, pr.y + pr.h * 0.83];
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
        s.heroPos = [pr.x + pr.w * 0.20, pr.y + pr.h * 0.91];
        s.buddyPos = [pr.x + pr.w * 0.80, pr.y + pr.h * 0.91];
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
      g.leaving = true;
      g.leaveT = 0;
      g.cakeSprite = s.cake.icing || 'cake-pink';
      g.dream = s.cake.icing === g.wantIcing;
      if (g.dream) { playSfx('pling'); api.particles.burst(g.x, g.y - 46, 16, { kind: 'star', colors: ['#ffe272', '#ff9ec4', '#88dbff'] }); }
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
      reactHeroStage(s.stage, 'both', 'skratt', 0.85);
      api.particles.burst(g.x, g.y - 24, 18, { kind: 'heart', colors: ['#ff88aa', '#ffe17a', '#ffffff'] });
      api.setProgress(s.served);
      if (s.served >= s.guests.length) {
        api.win(3);
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * (W >= H ? 0.83 : 0.88);
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
        if (s.cake.bounce > 0) s.cake.bounce = Math.max(0, s.cake.bounce - dt * 4);
        for (const g of s.guests) {
          if (g.hop > 0) g.hop = Math.max(0, g.hop - dt * 2.4);
          if (g.leaving && g.leaveT < 1.25) g.leaveT = Math.min(1.25, g.leaveT + dt * 0.85);
        }
        updateHeroStage(s.stage, dt, { won: api.levelWon, pts: standPoints(W, H) });
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

        // 2. Bakverktyg/ingredienser i brickan (främst — så gäster bakom aldrig stjäl trycket)
        for (const b of s.btns) {
          if (dist(x, y, b.x, b.y) < 36) {
            applyAction(b);
            return;
          }
        }

        // 3. Tryck på gäst: servera om tårtan är klar, annars hoppar gästen och visar sin drömtårta!
        for (let gi = 0; gi < s.guests.length; gi++) {
          const g = s.guests[gi];
          if (dist(x, y, g.x, g.y - 24) < 52) {
            if (s.cake.stage >= 2 && !g.got) {
              serveGuest(g);
            } else {
              g.hop = 1;
              playNote(gi + 1, 0.3);
              api.particles.burst(g.x, g.y - 40, 10, { kind: 'heart', colors: ['#ff9ec4', '#ffe17a'] });
            }
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

        // Djurgäster vid bageridiset — verklighetstrogna proportioner + hoppande avmarsch när de fått sin tårta
        const GUEST_H = {
          butterfly: 28, ladybug: 26, bird: 40,
          'bunny-baby': 42, 'hedge-baby': 40, 'fox-baby': 44, 'owl-baby': 42,
          hedge: 50, bunny: 54, owl: 56, fox: 68, bear: 82,
        };
        for (const g of s.guests) {
          const leaveProg = g.leaving ? clamp((g.leaveT - 0.35) / 0.85, 0, 1) : 0;
          const alpha = g.leaving ? clamp(1 - (g.leaveT - 0.92) / 0.32, 0, 1) : 1;
          if (alpha <= 0.01) continue;
          const gx = g.x + g.leaveDir * leaveProg * 185;
          const walkHop = leaveProg > 0 ? Math.abs(Math.sin(leaveProg * Math.PI * 3.5)) * 16 : 0;
          const gh = GUEST_H[g.id] || 52;

          ctx.save();
          ctx.globalAlpha = alpha;
          const readyToServe = s.cake.stage >= 2 && !g.got;
          if (readyToServe) drawGlowRing(ctx, T, gx, g.y - gh * 0.45, Math.max(28, gh * 0.6), 'rgba(255, 224, 112, 0.78)');
          const bob = (g.hop > 0 ? -Math.sin(g.hop * Math.PI) * 18 : Math.sin(T * 2.5 + g.x) * 2) - walkHop;
          drawShadow(ctx, gx, g.y + 4, Math.max(14, gh * 0.36), 5);
          blit(ctx, g.id, gx, g.y + bob, { h: gh, face: leaveProg > 0 ? g.leaveDir : 1 });
          if (!g.got && !api.won) {
            ctx.save();
            ctx.translate(gx + 18, g.y - gh - 14 + Math.sin(T * 2.5 + g.x) * 3);
            ctx.fillStyle = 'rgba(255, 252, 242, 0.92)';
            ctx.strokeStyle = 'rgba(154, 118, 66, 0.45)';
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 11.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
            blit(ctx, g.wantIcing, 0, 7, { h: 16, noTrack: true });
            ctx.restore();
          }
          if (g.got) {
            blit(ctx, g.cakeSprite, gx + g.leaveDir * 16, g.y + bob - 4, { h: 21 });
            ctx.save();
            ctx.translate(gx, g.y + bob - gh - 12);
            ctx.fillStyle = '#ff7da4';
            drawHeartPath(ctx, 8);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // Tårtfat i mitten
        if (!api.won) {
          drawShadow(ctx, s.standX, s.standY + 5, 36, 9);
          ctx.save();
          ctx.fillStyle = '#fff9ec';
          ctx.strokeStyle = '#c49d68';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.ellipse(s.standX, s.standY, 38, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
        }

        // Ingrediensbricka (när banan inte är klar)
        if (!api.won) {
          for (const b of s.btns) {
            ctx.save();
            ctx.fillStyle = 'rgba(253, 247, 234, 0.92)';
            ctx.strokeStyle = 'rgba(154, 118, 66, 0.45)';
            ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.restore();
            blit(ctx, b.sprite, b.x, b.y + 12, { h: 25 });
          }
        }

        // Båda systrarna — står stadigt på bagerigolvet (aldrig svävande i glaskupan)
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.24 : 1.36;
        if (!api.levelWon) {
          s.stage.lead.jump = Math.max(s.stage.lead.jump, s.heroJump);
          s.stage.buddy.jump = Math.max(s.stage.buddy.jump, s.buddyJump);
        }
        drawHeroStage(ctx, T, s.stage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon, leadPose: 'idle', buddyPose: 'idle',
        });

        // Tårtan under bakning / dragning (proportionerlig mot systrarna)
        if (!api.won && s.cake.stage >= 1) {
          const sc = (s.dragCake ? 1.12 : 1) + Math.sin(s.cake.bounce * Math.PI) * 0.14;
          const sp = s.cake.icing || 'cake-base';
          blit(ctx, sp, s.cake.x, s.cake.y + 8, { h: 48 * sc });
          if (s.cake.berry) blit(ctx, 'berry', s.cake.x - 9, s.cake.y - 20, { h: 16 * sc });
          if (s.cake.star) blit(ctx, 'star', s.cake.x + 9, s.cake.y - 21, { h: 17 * sc });
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
